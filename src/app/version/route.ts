import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

/**
 * WHICH BUILD IS DEPLOYED RIGHT NOW.
 *
 * THE PROBLEM THIS SOLVES. An installed PWA is a single long-lived page: after
 * the first load it navigates client-side and never fetches a document again,
 * so it keeps running the JavaScript bundle it downloaded on the day it was
 * opened. A laptop tab gets closed and reopened; a phone's home-screen app does
 * not. That is why a deployment shows up on a desktop within minutes and is
 * still invisible on a phone weeks later.
 *
 * The service worker was supposed to catch this — a new worker triggers a
 * reload — but only its BYTES changing counts as "new", and `sw.js` is a
 * hand-edited static file. Between 31 Jul and 09 Aug 2026 it went unchanged
 * across eighteen deployments, so no installed app reloaded once in that time.
 *
 * This endpoint gives the client something that changes on EVERY deployment
 * without anyone remembering to bump anything.
 *
 * WHY `.next/BUILD_ID` AND NOT A TIMESTAMP. The app runs under PM2 in cluster
 * mode, so consecutive requests are answered by different worker processes. A
 * value computed per process (`Date.now()` at module load) would differ between
 * workers, the client would see it flap, and every pull-to-refresh would reload
 * the app for no reason. `BUILD_ID` is written once by `next build` and is
 * byte-identical in every worker reading the same deployment.
 */

const BUILD_ID = (() => {
  try {
    return readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    // No build output — `next dev`. A per-process value is right here: a dev
    // server restart genuinely IS new code, so noticing it is correct.
    return `dev-${Date.now()}`;
  }
})();

// Read at runtime, never prerendered: a baked-in answer would describe the
// build that produced it rather than the build that is serving.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { build: BUILD_ID },
    // Must reach the device every time. The Cloudflare zone in front of this
    // app applies its own browser TTL to anything it considers static, and
    // `no-store` is the one directive it will not serve past.
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}
