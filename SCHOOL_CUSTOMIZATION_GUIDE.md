# School Customization Guide

This guide explains how to configure the app for a different school — name, logo, and API settings.

---

## Configuration Files

All school-specific settings live in **two places**:

| File | Purpose |
|------|---------|
| `frontend/.env` | App name, Splash Screen S3 API URL, API URL, etc. |

---

## Step-by-Step Setup for a New School

### Step 1 — Update Environment Variables

Edit `frontend/.env` with the school's specific values. The school logo is now fetched directly via S3 **at runtime** when the app loads (Splash Screen). The PWA installed app logo uses the standard Colegios branding.

```env
# School identity
NEXT_PUBLIC_SCHOOL_NAME=Your School Name Here
# Provide the direct public S3 URL to the school's logo
NEXT_PUBLIC_SCHOOL_LOGO_URL=https://appme-public-assets.s3.ap-south-1.amazonaws.com/schools/edusphere/logo.jpg

# Backend API URL (where your backend is hosted)
NEXT_PUBLIC_API_URL=https://your-backend-domain.com

# Frontend URL (where this app is hosted)
NEXT_PUBLIC_FRONTEND_URL=https://your-frontend-domain.com

# Razorpay payment keys (get from Razorpay dashboard)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
```

### Step 2 — Build and Deploy

Because the logo is fetched purely dynamically now via S3 at runtime, there are no special image regeneration scripts needed! Just build and run.

```bash
# Inside the frontend/ folder:
npm run build
npm run start
```

---

## What the School Name Configures

Setting `NEXT_PUBLIC_SCHOOL_NAME` automatically updates:

- ✅ Browser tab title (e.g., *Dashboard | EduSphere Academy*)
- ✅ Installed app name on Android/iOS home screen
- ✅ In-app PWA install banner ("Install EduSphere Academy")
- ✅ Apple web app title
- ✅ Web app manifest `name` and `short_name`

## What the Logo Configures

Running `generate-pwa-icons.mjs` after updating the logo updates:

- ✅ Android/iOS home screen icon
- ✅ Browser tab favicon
- ✅ PWA splash screen
- ✅ In-app install banner image

---

## Testing the PWA Install

> The service worker and install prompt are **only active in production** (not `npm run dev`). To test locally:

```bash
npm run build
npm run start
# Then open http://localhost:3000 in Chrome or Edge
```

In Chrome/Edge DevTools → **Application** tab → check:
- **Manifest** — should show your school name and icons
- **Service Workers** — should show `sw.js` as registered
- **Lighthouse** → PWA audit → should pass all checks

---

## Quick Reference

```
frontend/
├── .env                            ← School name, API URL, payment keys
├── generate-pwa-icons.mjs          ← Run this after changing the logo
└── public/
    ├── school-assets/
    │   └── logo.png                ← ⬅ Replace this with the school's logo
    ├── icons/
    │   ├── icon-192x192.png        ← Auto-generated (do not edit manually)
    │   ├── icon-512x512.png        ← Auto-generated
    │   └── icon-maskable-512x512.png  ← Auto-generated
    ├── apple-touch-icon.png        ← Auto-generated (iOS)
    └── favicon-32x32.png           ← Auto-generated (browser tab)
```
