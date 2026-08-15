import type { Metadata, Viewport } from "next";
import { Sora, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import ServiceUnavailableBanner from "@/components/ServiceUnavailableBanner";
import SupportSessionNotices from "@/components/SupportSessionNotices";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PaletteProvider } from "@/components/providers/PaletteProvider";

// Force dynamic rendering so process.env is read at request time (from SSM-loaded runtime env),
// not baked in at build time when env vars are not available.
export const dynamic = 'force-dynamic';

/**
 * Three faces, three jobs — see the header of globals.css.
 *   Sora           titles, stat figures — the display voice
 *   Figtree        every label, cell and paragraph you actually read
 *   IBM Plex Mono  every number, ID, date and micro-label, tabular by default
 */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  // The rail colour, so the phone's status bar continues the chrome rather than
  // sitting on a seam above it. A single un-scoped value on purpose: the real
  // colour depends on the palette AND the mode, which no media query knows, so
  // PaletteProvider rewrites this tag at runtime. This is only the value that
  // holds for the few milliseconds before it does — the walnut rail, which is
  // the default palette in both modes.
  themeColor: "#362b1f",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available: this is an ERP read on phones all day, and
  // capping the scale is the one accessibility failure users cannot work around.
  maximumScale: 5,
  userScalable: true,
};

const schoolName = process.env.SCHOOL_NAME || 'School Management System';

export const metadata: Metadata = {
  title: {
    template: `%s | ${schoolName}`,
    default: schoolName,
  },
  description: `A comprehensive school management system for ${schoolName}.`,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: schoolName,
  },
  formatDetection: {
    telephone: false,
  },
  // Both entries used to point at /colegios/pwa-logo.png, which is 1024×1024
  // and 723 KB while declaring sizes="192x192" — so the browser downloaded
  // three-quarters of a megabyte and scaled 1024px down to a 16px tab icon.
  // That is why the favicon looked blank or muddy: it is a real bug, not a
  // caching artefact. Correctly-sized files were already in public/ and simply
  // unreferenced. Sizes below are the files' true dimensions; a browser picks
  // the closest one instead of resampling the largest.
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envConfig = {
    API_URL: process.env.API_URL,
    SCHOOL_SLUG: process.env.SCHOOL_SLUG,
    FRONTEND_URL: process.env.FRONTEND_URL,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    AI_API_URL: process.env.AI_API_URL,
  };

  return (
    // The font variables must land on <html>, not <body>: globals.css defines
    // --font-sans/--font-display at :root in terms of these, and a var() that
    // cannot resolve where it is *declared* computes to invalid and then
    // inherits as empty — so putting them on <body> silently kills every font.
    <html
      lang="en"
      className={`${sora.variable} ${figtree.variable} ${plexMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(envConfig)};`,
          }}
        />
        {/* Stamp both theme axes before the first paint.
            next-themes injects its own script, but the provider renders inside
            <body>, so that script runs after <head> is parsed and the default
            theme is briefly visible. Doing it here covers the palette (which
            next-themes knows nothing about) and closes that flash for the mode
            at the same time. Kept dependency-free and wrapped in try/catch:
            it runs before anything else and must never be able to throw. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;
var p=localStorage.getItem('palette');
d.setAttribute('data-palette',(p==='ink'||p==='assembly')?p:'ink');
var t=localStorage.getItem('theme')||'light';
if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
if(t==='dark'||t==='light'){d.setAttribute('data-theme',t);}
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          <PaletteProvider>
            {children}
            <PWAInstallBanner />
            <ServiceWorkerRegistrar />
            <ServiceUnavailableBanner />
            <SupportSessionNotices />
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
