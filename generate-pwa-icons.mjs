/**
 * PWA Icon Generator for School Management System
 *
 * Usage: node generate-pwa-icons.mjs
 *
 * Source: public/school-assets/logo.png  (replace this with the school's logo)
 * Output: public/icons/ and public/ (overwrites existing files)
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE = path.join(__dirname, 'public/school-assets/logo.png');
const ICONS_DIR = path.join(__dirname, 'public/icons');

// Verify source exists
if (!existsSync(SOURCE)) {
    console.error('❌  Source logo not found at: public/school-assets/logo.png');
    console.error('    Please place the school logo (square PNG, min 512×512) at that path and re-run.');
    process.exit(1);
}

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

console.log('🔄  Generating PWA icons from public/school-assets/logo.png ...\n');

for (const { size, dest } of icons) {
    await sharp(SOURCE)
        .resize(size, size)
        .png()
        .toFile(dest);

    const relative = path.relative(__dirname, dest);
    console.log(`  ✅  ${size}×${size}  →  ${relative}`);
}

console.log('\n🎉  Done! Run "npm run build" to apply the new icons.');
