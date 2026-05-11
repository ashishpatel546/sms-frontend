import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/proxy-logo?url=<encoded-s3-url>
 *
 * Fetches a school logo from S3 server-side (Node.js has no CORS restrictions)
 * and returns it from the same origin as the frontend. This allows html-to-image
 * to embed the logo in PDF/print output via a same-origin fetch().
 *
 * Security: only S3 URLs under the /schools/ prefix are proxied.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse(null, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Security: only allow HTTPS S3 URLs for the /schools/ key prefix.
  // This prevents SSRF attacks — we never proxy arbitrary URLs.
  const isAllowedS3Url =
    parsed.protocol === 'https:' &&
    /\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/.test(parsed.hostname) &&
    parsed.pathname.startsWith('/schools/');

  if (!isAllowedS3Url) {
    return new NextResponse(null, { status: 403 });
  }

  try {
    const s3Res = await fetch(url);
    if (!s3Res.ok) {
      return new NextResponse(null, { status: s3Res.status });
    }

    const buffer = await s3Res.arrayBuffer();
    const contentType = s3Res.headers.get('content-type') ?? 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
