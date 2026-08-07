import type { Metadata, Viewport } from "next";
import { Sora, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import ServiceUnavailableBanner from "@/components/ServiceUnavailableBanner";
import SupportSessionNotices from "@/components/SupportSessionNotices";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

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
  // Matches the ink rail so the phone's status bar continues the chrome
  // rather than sitting on a white seam above it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0f1c" },
    { media: "(prefers-color-scheme: dark)", color: "#060a14" },
  ],
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
  icons: {
    icon: [
      { url: "/colegios/pwa-logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/colegios/pwa-logo.png", sizes: "180x180", type: "image/png" },
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
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          {children}
          <PWAInstallBanner />
          <ServiceWorkerRegistrar />
          <ServiceUnavailableBanner />
          <SupportSessionNotices />
        </ThemeProvider>
      </body>
    </html>
  );
}
