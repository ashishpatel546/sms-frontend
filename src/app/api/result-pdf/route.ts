import { NextRequest, NextResponse } from 'next/server';
import type {
  ResultDataForPDF,
  SchoolInfoForResultPDF,
} from '@/lib/result-pdf-document';
import { renderResultPDF } from '@/lib/result-pdf-document';

/**
 * POST /api/result-pdf
 *
 * Accepts student result data from the client, fetches school info server-side,
 * embeds the logo as base64, then generates a PDF via @react-pdf/renderer
 * (pure JS – no Chromium).
 *
 * Response header: Content-Disposition: inline      → opens in browser tab (for print)
 *                  Content-Disposition: attachment   → triggers file download
 * The caller decides by including { action: 'print' | 'download' } in the body.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse body ────────────────────────────────────────────────────────
  let body: {
    resultData?: ResultDataForPDF;
    action?: 'print' | 'download';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { resultData, action = 'download' } = body;
  if (!resultData) {
    return NextResponse.json(
      { error: 'resultData is required' },
      { status: 400 },
    );
  }

  // ── Forward auth headers to backend ───────────────────────────────────
  const authHeader = request.headers.get('authorization') ?? '';
  const schoolSlug = request.headers.get('x-school-slug') ?? '';
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000';

  // ── Fetch school info server-side (no CORS issues) ────────────────────
  let schoolRaw: Record<string, unknown> = {};
  try {
    const res = await fetch(`${apiUrl}/school/info`, {
      headers: {
        Authorization: authHeader,
        'X-School-Slug': schoolSlug,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      schoolRaw = await res.json();
    }
  } catch {
    // fallback: schoolRaw stays empty, defaults below apply
  }

  // ── Fetch logo → base64 ───────────────────────────────────────────────
  let logoBase64: string | null = null;
  const logoUrl =
    typeof schoolRaw.logoUrl === 'string' ? schoolRaw.logoUrl : null;
  if (logoUrl) {
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        const buffer = await logoRes.arrayBuffer();
        const contentType = logoRes.headers.get('content-type') ?? 'image/png';
        logoBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
      }
    } catch {
      // no logo — result renders without it
    }
  }

  const schoolInfo: SchoolInfoForResultPDF = {
    name: typeof schoolRaw.name === 'string' ? schoolRaw.name : 'School',
    tagline: typeof schoolRaw.tagline === 'string' ? schoolRaw.tagline : null,
    address: typeof schoolRaw.address === 'string' ? schoolRaw.address : null,
    phone: typeof schoolRaw.phone === 'string' ? schoolRaw.phone : null,
    email: typeof schoolRaw.email === 'string' ? schoolRaw.email : null,
    website: typeof schoolRaw.website === 'string' ? schoolRaw.website : null,
    logoBase64,
  };

  // ── Generate PDF via @react-pdf/renderer ──────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderResultPDF(resultData, schoolInfo);
  } catch (err) {
    console.error('[result-pdf] render error:', err);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 },
    );
  }

  const studentSlug = resultData.studentName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);

  const filename = `result-${studentSlug || 'student'}.pdf`;
  const disposition =
    action === 'print'
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  });
}
