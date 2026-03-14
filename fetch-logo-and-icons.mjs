/**
 * fetch-logo-and-icons.mjs
 *
 * Pre-build script — runs automatically via "prebuild" in package.json.
 *
 * 1. Reads SCHOOL_SLUG + COLEGIO_HUB_API_URL + COLEGIO_SERVICE_TOKEN from env
 * 2. Calls GET {hub}/schools/{slug}/logo-url with the service token
 * 3. Downloads the logo from the returned presigned S3 URL
 * 4. Writes it to public/school-assets/logo.png
 * 5. Runs generate-pwa-icons.mjs to regenerate all PWA icon sizes
 *
 * Required env vars (set in CI/CD pipeline secrets):
 *   COLEGIO_HUB_API_URL   — e.g. https://hub-api.colegios.in
 *   COLEGIO_SERVICE_TOKEN — generated from Colegio Hub for this school
 *   SCHOOL_SLUG           — e.g. dps
 *
 * If any of these are missing the script exits with code 0 and a warning
 * so that local dev without Hub access still works (uses whatever logo is
 * already in public/school-assets/logo.png).
 */

import { execSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const HUB_API_URL = process.env.COLEGIO_HUB_API_URL;
const SERVICE_TOKEN = process.env.COLEGIO_SERVICE_TOKEN;
const SCHOOL_SLUG = process.env.SCHOOL_SLUG;

if (!HUB_API_URL || !SERVICE_TOKEN || !SCHOOL_SLUG) {
  console.warn(
    '⚠  COLEGIO_HUB_API_URL / COLEGIO_SERVICE_TOKEN / SCHOOL_SLUG not set.\n' +
      '   Skipping logo fetch — using existing public/school-assets/logo.png.\n' +
      '   Set these env vars in CI/CD to enable automatic logo download.\n'
  );
  process.exit(0);
}

console.log(`🔑  Fetching presigned logo URL for school: ${SCHOOL_SLUG}`);

// Step 1 — get presigned URL from Colegio Hub
const res = await fetch(`${HUB_API_URL}/schools/${SCHOOL_SLUG}/logo-url`, {
  headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`❌  Hub API returned ${res.status}: ${body}`);
  process.exit(1);
}

const { presignedUrl } = await res.json();
console.log(`✅  Got presigned URL (${res.status})`);

// Step 2 — download logo from S3
console.log('📥  Downloading logo from S3…');
const logoRes = await fetch(presignedUrl);
if (!logoRes.ok) {
  console.error(`❌  S3 download failed: ${logoRes.status}`);
  process.exit(1);
}

const destDir = path.join(ROOT, 'public', 'school-assets');
mkdirSync(destDir, { recursive: true });
const destPath = path.join(destDir, 'logo.png');

await pipeline(Readable.fromWeb(logoRes.body), createWriteStream(destPath));
console.log(`✅  Logo saved to public/school-assets/logo.png`);

// Step 3 — regenerate PWA icons
console.log('🔄  Regenerating PWA icons…');
execSync('node generate-pwa-icons.mjs', { cwd: ROOT, stdio: 'inherit' });
console.log('✅  PWA icons regenerated\n');
