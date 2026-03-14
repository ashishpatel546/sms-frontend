/**
 * PWA Icon Generator for School Management System
 *
 * Usage: node generate-pwa-icons.mjs
 *
 * Logo resolution order:
 *   1. public/school-assets/{SCHOOL_SLUG}_logo.png  (slug-specific logo)
 *   2. public/school-assets/logo.png                (generic fallback)
 *
 * Set NEXT_PUBLIC_SCHOOL_SLUG in .env.local (or .env) to enable slug-based lookup.
 * Output: public/icons/ and public/ (overwrites existing files)
 */

import sharp from 'sharp';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env vars from .env.local then .env (simple key=value parser, no dotenv dep needed)
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    vars[key] = value;
  }
  return vars;
}

const envVars = {
  ...loadEnvFile(path.join(__dirname, '.env')),
  ...loadEnvFile(path.join(__dirname, '.env.local')),
};

const slug =
  process.env.NEXT_PUBLIC_SCHOOL_SLUG ?? envVars['NEXT_PUBLIC_SCHOOL_SLUG'];
const SCHOOL_ASSETS = path.join(__dirname, 'public/school-assets');
const FALLBACK = path.join(SCHOOL_ASSETS, 'logo.png');

let SOURCE;
if (slug) {
  const slugLogo = path.join(SCHOOL_ASSETS, `${slug}_logo.png`);
  if (existsSync(slugLogo)) {
    SOURCE = slugLogo;
    console.log(
      `ℹ️   Using slug-specific logo: public/school-assets/${slug}_logo.png`
    );
  } else {
    console.warn(
      `⚠️   Slug logo not found (public/school-assets/${slug}_logo.png), falling back to logo.png`
    );
  }
}

if (!SOURCE) {
  if (!existsSync(FALLBACK)) {
    console.error('❌  No logo found. Provide either:');
    console.error(
      `    public/school-assets/${slug ? slug + '_logo.png or ' : ''}logo.png`
    );
    console.error('    (square PNG, min 512×512)');
    process.exit(1);
  }
  SOURCE = FALLBACK;
  console.log('ℹ️   Using default logo: public/school-assets/logo.png');
}

const ICONS_DIR = path.join(__dirname, 'public/icons');

// Ensure output directory exists
mkdirSync(ICONS_DIR, { recursive: true });

// Essential icon sizes only
const icons = [
  // Minimum required for Chrome/Android PWA install prompt
  { size: 192, dest: path.join(ICONS_DIR, 'icon-192x192.png') },
  // High-res splash screen & Play Store
  { size: 512, dest: path.join(ICONS_DIR, 'icon-512x512.png') },
  // Adaptive / maskable icon (Android 8+)
  { size: 512, dest: path.join(ICONS_DIR, 'icon-maskable-512x512.png') },
  // iOS "Add to Home Screen"
  { size: 180, dest: path.join(__dirname, 'public/apple-touch-icon.png') },
  // Browser tab favicon
  { size: 32, dest: path.join(__dirname, 'public/favicon-32x32.png') },
];

console.log(
  `🔄  Generating PWA icons from ${path.relative(__dirname, SOURCE)} ...\n`
);

for (const { size, dest } of icons) {
  await sharp(SOURCE).resize(size, size).png().toFile(dest);

  const relative = path.relative(__dirname, dest);
  console.log(`  ✅  ${size}×${size}  →  ${relative}`);
}

console.log('\n🎉  Done! Run "npm run build" to apply the new icons.');
