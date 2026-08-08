/**
 * photo-pipeline.ts — pick → crop → downscale → encode, entirely in the browser.
 *
 * WHY THE BROWSER DOES THIS
 *
 * A parent at the admissions counter hands over a phone photo: 4000×3000,
 * 5 MB, landscape, with half a classroom in the frame. The server accepts at
 * most 2 MB and the school is on a shared connection. Rejecting that file
 * ("too large") pushes the work onto the person least equipped to do it, so
 * this module downsizes instead. The ONLY thing worth refusing is a file that
 * is not an image at all.
 *
 * WHAT COMES OUT
 *
 *   full   3:4 portrait, longest side ≤ 1200px, WebP q0.85 → typically
 *          180–320 KB from a 5 MB phone photo. Ceiling of 900 KB enforced by
 *          re-encoding at lower quality, well inside the server's 2 MB.
 *   thumb  the same crop at 200px, WebP q0.82 → typically 8–16 KB. Ceiling of
 *          96 KB, inside the server's 128 KB.
 *
 * The 3:4 lock is not an aesthetic preference: these photos are printed onto
 * ID cards, and a sheet of mixed ratios prints as a sheet of mistakes.
 */

/** Every photo slot is portrait 3:4 — width : height. */
export const PHOTO_ASPECT = 3 / 4;

/** Longest side of the stored full-size image. */
const FULL_MAX_EDGE = 1200;
/** Longest side of the list/form thumbnail. */
const THUMB_MAX_EDGE = 200;

/** Quality ladder, walked downward only if the blob misses its ceiling. */
const FULL_QUALITY_STEPS = [0.85, 0.72, 0.6, 0.5];
const THUMB_QUALITY_STEPS = [0.82, 0.7, 0.6];

/** Own ceilings, set below the server's 2 MB / 128 KB so a retry is never needed. */
const FULL_BYTE_CEILING = 900 * 1024;
const THUMB_BYTE_CEILING = 96 * 1024;

/** The crop rectangle react-easy-crop reports, in source-image pixels. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreparedPhoto {
  full: Blob;
  thumb: Blob;
  /** Object URL for the thumbnail. The caller owns it and must revoke it. */
  previewUrl: string;
  fullBytes: number;
  thumbBytes: number;
}

/* ── Input ──────────────────────────────────────────────────────────────── */

export function isImageFile(file: File): boolean {
  return typeof file.type === 'string' && file.type.startsWith('image/');
}

/**
 * Decode a picked file into an `<img>`. The object URL is returned rather than
 * revoked here because the cropper renders from it for as long as the dialog
 * is open.
 */
export function loadImageFromFile(
  file: File,
): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That image could not be read. Try a different file.'));
    };
    image.src = objectUrl;
  });
}

/* ── Canvas work ────────────────────────────────────────────────────────── */

/** Bounding box of an image rotated by `degrees`. */
function rotatedSize(width: number, height: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  };
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not prepare the image.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/**
 * Draw the rotated source, then lift out the crop rectangle.
 *
 * The rotation has to be baked in before the crop is taken: react-easy-crop
 * reports the crop in the coordinates of the *rotated* image, so cropping the
 * original first would cut the wrong rectangle.
 */
function drawCrop(
  image: HTMLImageElement,
  area: CropArea,
  rotation: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = context2d(canvas);

  const bounds = rotatedSize(image.width, image.height, rotation);
  canvas.width = Math.round(bounds.width);
  canvas.height = Math.round(bounds.height);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const width = Math.max(1, Math.round(area.width));
  const height = Math.max(1, Math.round(area.height));
  const data = ctx.getImageData(Math.round(area.x), Math.round(area.y), width, height);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  context2d(out).putImageData(data, 0, 0);
  return out;
}

/**
 * Downscale to `maxEdge` on the longest side.
 *
 * Halving in steps rather than one big jump: a single draw from 3000px to
 * 200px drops most of the pixels on the floor and the result looks like it was
 * sharpened with a hammer.
 */
function scaleTo(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  let current = source;
  let longest = Math.max(current.width, current.height);
  if (longest <= maxEdge) return current;

  while (longest / 2 > maxEdge) {
    const next = document.createElement('canvas');
    next.width = Math.max(1, Math.round(current.width / 2));
    next.height = Math.max(1, Math.round(current.height / 2));
    context2d(next).drawImage(current, 0, 0, next.width, next.height);
    current = next;
    longest = Math.max(current.width, current.height);
  }

  const ratio = maxEdge / longest;
  const final = document.createElement('canvas');
  final.width = Math.max(1, Math.round(current.width * ratio));
  final.height = Math.max(1, Math.round(current.height * ratio));
  context2d(final).drawImage(current, 0, 0, final.width, final.height);
  return final;
}

/* ── Encoding ───────────────────────────────────────────────────────────── */

let webpSupport: boolean | null = null;

/**
 * WebP is roughly a third the size of JPEG at the same perceived quality, and
 * the server accepts it. Safari before 14 does not encode it and silently
 * hands back a PNG, so the result type is checked rather than assumed.
 */
function encodeMime(): 'image/webp' | 'image/jpeg' {
  if (webpSupport === null) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      webpSupport = probe.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport ? 'image/webp' : 'image/jpeg';
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Encode, stepping the quality down until the blob fits. The ladder almost
 * never advances past its first rung — it exists so an unusually noisy photo
 * (which compresses badly) still lands inside the server's limit instead of
 * being rejected after the upload.
 */
async function encodeUnder(
  canvas: HTMLCanvasElement,
  ceilingBytes: number,
  qualities: number[],
): Promise<Blob> {
  const mime = encodeMime();
  let last: Blob | null = null;

  for (const quality of qualities) {
    const blob = await toBlob(canvas, mime, quality);
    if (!blob) continue;
    last = blob;
    if (blob.size <= ceilingBytes) return blob;
  }

  if (last) return last;
  throw new Error('This browser could not save the cropped image.');
}

/* ── The one entry point ────────────────────────────────────────────────── */

/**
 * Turn a cropped region into the pair the upload endpoint wants.
 *
 * Both outputs come from the SAME cropped canvas, so the thumbnail can never
 * frame the face differently from the full image.
 */
export async function preparePhoto(
  image: HTMLImageElement,
  area: CropArea,
  rotation = 0,
): Promise<PreparedPhoto> {
  const cropped = drawCrop(image, area, rotation);

  const full = await encodeUnder(
    scaleTo(cropped, FULL_MAX_EDGE),
    FULL_BYTE_CEILING,
    FULL_QUALITY_STEPS,
  );
  const thumb = await encodeUnder(
    scaleTo(cropped, THUMB_MAX_EDGE),
    THUMB_BYTE_CEILING,
    THUMB_QUALITY_STEPS,
  );

  return {
    full,
    thumb,
    previewUrl: URL.createObjectURL(thumb),
    fullBytes: full.size,
    thumbBytes: thumb.size,
  };
}

/** "248 KB" — for the line that tells someone what was actually stored. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
