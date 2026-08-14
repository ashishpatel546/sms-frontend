/* ═══════════════════════════════════════════════════════════════════════════
   CODE 128-B — a self-contained encoder + canvas renderer.

   Why not a library: the only thing we need is "turn an item code into a
   PNG a laser scanner can read", and every candidate (`jsbarcode`, `bwip-js`)
   drags in a DOM/SVG layer we'd immediately bypass. More to the point, adding
   a dependency on this machine prunes other platforms' optional packages out
   of the lockfile and breaks `npm ci` on Linux CI — a real cost for ~90 lines
   of table lookup.

   Code Set B is used throughout: it covers ASCII 32–126, which is every
   character an inventory code can legally contain. Set C would pack digit
   pairs more tightly, but codes like `INV-0042` are mixed anyway, and a
   single-set symbol is one less thing to get subtly wrong.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The 107 Code 128 symbols as module-width runs, bar first, alternating.
 * Index = symbol value; 103/104/105 are Start A/B/C, 106 is Stop.
 * Every data symbol is 11 modules wide; Stop is 13.
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/** Modules of blank on each side, without which a scanner cannot lock on. */
export const QUIET_MODULES = 10;

/** Code 128-B carries ASCII 32–126 and nothing else. */
export function isEncodableCode128B(text: string): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

/**
 * Encodes `text` to alternating bar/space module widths, starting with a bar.
 * Quiet zones are *not* included — the renderer adds them, so callers that
 * want raw symbol geometry get exactly that.
 */
export function encodeCode128B(text: string): number[] {
  if (!isEncodableCode128B(text)) {
    throw new Error('Code 128-B can only encode printable ASCII (32–126)');
  }

  const values: number[] = [START_B];
  for (let i = 0; i < text.length; i += 1) values.push(text.charCodeAt(i) - 32);

  // Checksum: start value, then each data value weighted by its 1-based
  // position, modulo 103.
  let sum = START_B;
  for (let i = 0; i < text.length; i += 1) sum += (i + 1) * (text.charCodeAt(i) - 32);
  values.push(sum % 103);
  values.push(STOP);

  const widths: number[] = [];
  for (const value of values) {
    for (const ch of PATTERNS[value]) widths.push(Number(ch));
  }
  return widths;
}

/** Total module width of the symbol, quiet zones included. */
export function code128Width(text: string): number {
  return encodeCode128B(text).reduce((a, b) => a + b, 0) + QUIET_MODULES * 2;
}

export interface Code128RenderOptions {
  /** Device pixels per module. Higher = crisper when the PDF scales it up. */
  moduleWidth?: number;
  /** Bar height in device pixels. */
  height?: number;
  /** Print the human-readable text under the bars. */
  showText?: boolean;
  /** Font size in device pixels for the caption. */
  fontSize?: number;
}

/**
 * Renders the symbol to a PNG data URL via an offscreen canvas.
 *
 * Rendered at whole-pixel module boundaries — a fractional module width is
 * the classic reason a barcode prints beautifully and scans not at all, so
 * `moduleWidth` is rounded up to an integer rather than trusted as given.
 */
export function renderCode128DataUrl(
  text: string,
  options: Code128RenderOptions = {},
): string {
  const moduleWidth = Math.max(1, Math.round(options.moduleWidth ?? 2));
  const barHeight = Math.max(8, Math.round(options.height ?? 60));
  const showText = options.showText ?? true;
  const fontSize = Math.round(options.fontSize ?? 14);
  const captionBand = showText ? fontSize + 6 : 0;

  const widths = encodeCode128B(text);
  const modules = widths.reduce((a, b) => a + b, 0) + QUIET_MODULES * 2;

  const canvas = document.createElement('canvas');
  canvas.width = modules * moduleWidth;
  canvas.height = barHeight + captionBand;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  let x = QUIET_MODULES * moduleWidth;
  let isBar = true;
  for (const run of widths) {
    const w = run * moduleWidth;
    if (isBar) ctx.fillRect(x, 0, w, barHeight);
    x += w;
    isBar = !isBar;
  }

  if (showText) {
    ctx.fillStyle = '#000000';
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, canvas.width / 2, barHeight + 3);
  }

  return canvas.toDataURL('image/png');
}
