import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

// Force dynamic rendering so process.env is read at request time (from SSM-loaded runtime env),
// not baked in at build time when env vars are not available.
export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      { url: "/colegios/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/colegios/logo.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envConfig = {
    SCHOOL_NAME: process.env.SCHOOL_NAME,
    SCHOOL_LOGO_URL: process.env.SCHOOL_LOGO_URL,
    API_URL: process.env.API_URL,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    FRONTEND_URL: process.env.FRONTEND_URL,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  };

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(envConfig)};`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <PWAInstallBanner />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
