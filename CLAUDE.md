# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`sms-frontend` is the Next.js (App Router) web client for a multi-tenant School Management System. It talks to `sms-backend` (NestJS API) for all core domain data and directly to `school-ai` (FastAPI) for AI features (chat, quiz/worksheet/lesson-plan generation, streaming). A separate `sms-hub-backend`/`sms-hub-frontend` acts as the central tenant registry ("Colegio Hub").

## Commands

```bash
npm run dev      # next dev — local dev server on PORT from .env (default 3000)
npm run build    # next build — production build
npm run start    # next start — serve a production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

There is no test runner configured in this repo (no Jest/Vitest/Playwright in `package.json`) — do not assume `npm test` exists.

Process management in deployed environments uses PM2 (`ecosystem.config.js`), with separate `sms-frontend-dev` and `sms-frontend-prod` apps that load env via `env_file: '.env'`.

## Local dev over Cloudflare tunnel (mobile testing)

Local dev is exposed to the internet through a named Cloudflare tunnel (`home-app`) so the app can be tested on real phones/tablets (PWA install, push notifications, camera/QR flows), not just a desktop browser. Config lives at `~/.cloudflared/config.yml`; the PowerShell profile provides `c-tunnel` (run the tunnel) and `cloudflared-config` (open the config in VS Code). Ingress map (specific hostnames must stay ABOVE the `*.appme.in` wildcard — cloudflared matches in order):

| Hostname | Local service |
|---|---|
| `*.appme.in` wildcard (e.g. `edusphere.appme.in`), also `myrealapp.appme.in` | **sms-frontend (this app)** — `localhost:3000` (subdomain doubles as the tenant slug — see `getSchoolSlug()`) |
| `myapp.appme.in` | sms-backend API — `localhost:5000` |
| `ai-api.appme.in` | school-ai — `localhost:8001` (long keep-alive for slow AI generations) |
| `hub.appme.in` | sms-hub-frontend — `localhost:3001` |
| `hub-api.appme.in` | sms-hub-backend — `localhost:5001` |

**Responsive + PWA requirement:** this app is an installable PWA used on phones, tablets, laptops, and large desktop screens. Every UI change must be responsive across all four sizes — verify at mobile (~360–430px), tablet (~768–1024px), laptop, and large desktop widths before considering UI work done. Real-device mobile verification happens through the tunnel hostnames above.

## Multi-tenant identity — read this before touching auth/env code

This is a single deployed codebase serving many schools. There is no build-per-school step in the current pipeline (the old prebuild logo-fetch script in `fetch-logo-and-icons.mjs` is explicitly deprecated/unused — school branding is now fetched at **runtime**, not baked in at build time).

- **`src/lib/env.ts`** (`getSchoolSlug()`) derives the tenant slug from the **browser hostname** at request time: `<slug>.colegios.in`, `<slug>.test.colegios.in` (staging), `<slug>.localhost` (dev), or `<slug>.appme.in` (Cloudflare tunnel), falling back to the `SCHOOL_SLUG` env var only when no subdomain is available (bare IP/Docker).
- **`getEnv(key)`** reads from `window.__ENV__` on the client and `process.env` on the server. `window.__ENV__` is injected by an inline script in `src/app/layout.tsx` (`API_URL`, `SCHOOL_SLUG`, `FRONTEND_URL`, `VAPID_PUBLIC_KEY`, `AI_API_URL`) — this is how server-only env vars become available client-side without a `NEXT_PUBLIC_` prefix. The root layout also sets `export const dynamic = 'force-dynamic'` specifically so these are read per-request rather than frozen at build time (important because prod loads env via SSM at boot, not at build).
- Every request to `sms-backend` must carry the resolved slug as an `X-School-Slug` header (see `getAuthHeaders()` in `src/lib/auth.ts`) so the backend can scope to the correct tenant.
- `src/lib/useSchoolInfo.ts` fetches branding (`GET /school/info`) once per slug and caches it (in-memory + localStorage, without the large `logoDataUrl` field) so components like the receipt modal don't refetch.

## Auth & API client pattern

- JWTs (access + refresh) are stored in `localStorage` (`src/lib/auth.ts`). `getUser()` decodes the access token's payload client-side (no server verification) to get `{ sub, role, firstName, lastName, mustChangePassword, staffId }` — treat this as a UI convenience, not a security boundary.
- **`authFetch()`** in `src/lib/auth.ts` is the one place that knows how to refresh: on a 401 it transparently calls `/auth/refresh-token`, queues concurrent callers behind a single in-flight refresh (`isRefreshing`/`refreshSubscribers`), retries the original request, and only calls `logout()` on a genuine server rejection — **never** on a network error/abort (Android backgrounding a PWA aborts fetches; that must not log the user out). `resetRefreshState()` is called from a `visibilitychange` listener in the dashboard layout to un-stick a refresh that got aborted while backgrounded.
- **`src/lib/api.ts`** exports `fetcher`, a thin wrapper around `authFetch` meant for use with SWR (`swr` is a dependency). Prefer `fetcher`/SWR for GET data; use `authFetch` directly for mutations.
- `getDashboardRoute(role)` and role-based redirects: `PARENT` → `/parent-dashboard`, everyone else → `/dashboard`. Dashboard layouts re-run `silentRefresh()` on mount specifically so a role change made server-side (e.g. promotion to HR_ADMIN) takes effect on next page load rather than waiting for the 7-day token to expire.

## RBAC

`src/lib/rbac.ts` exports `useRbac()`, a client hook that decodes the current role into a flat `RbacPermissions` object (`isAdmin`, `canAccessFees`, `canManageStudents`, `canAccessHR`, ...) derived from a numeric `ROLE_LEVEL` hierarchy (`SUPER_ADMIN` 100 → `STUDENT` 10) that **mirrors a hierarchy on the backend** — if roles change, update both. Two roles are intentionally *not* purely hierarchical and need special-casing when adding new permissions:
- **HR Portal** (`canAccessHR`/`canManageHR`) is restricted to `HR_ADMIN` or `SUPER_ADMIN` only — a plain `ADMIN` does *not* get it, even though ADMIN outranks HR_ADMIN numerically. Payroll finalize (`canManagePayroll`) is a deliberate exception that *does* stay ADMIN+.
- **GUARD** is deny-by-default in navigation: `src/lib/navConfig.ts` items need `guardAllowed: true` to show up for a GUARD user; unkeyed items are visible to everyone else but hidden from GUARD unless explicitly flagged.

`src/lib/navConfig.ts` (`NAV_CONFIG`) is the single source of truth for sidebar/bottom-nav structure — grouped sections, icon, `rbacKey` gating, and `guardAllowed`. Add new dashboard routes here rather than hardcoding links in the Sidebar component.

## Routing / page structure (App Router)

- `src/app/dashboard/**` — the staff/admin app (students, staff, fees, examinations, HR, library, visitors, AI tools, etc.), wrapped by `src/app/dashboard/layout.tsx` which handles auth bootstrap, role redirects, sidebar/bottom-tab-bar chrome, and a mobile "quick actions" sheet built from `rbac` flags.
- `src/app/parent-dashboard/**` — a separate, narrower portal for the `PARENT` role.
- `src/app/dashboard/hr/**` / `my-attendance` / `my-leaves` / `my-salary` — HR Portal (staff-management side) vs. "My HR" (self-service side, gated by `canAccessHRSelfService`, available to GUARD too).
- `src/app/dashboard/ai/**` — one route per AI feature (chat, quiz, explain, lesson-plan, question-paper, worksheet, assignment, learning-path, teacher-chat, subscription). Each is wrapped in `<FeatureGate feature="...">` (`src/components/ai/FeatureGate.tsx`), which reads `useAiAccess()` and shows a lock/upgrade screen if the plan doesn't include that feature, a connection-error state if the AI service is unreachable (never conflated with "no plan"), or the feature itself.
- `src/app/api/**` — Next.js Route Handlers used as small server-side proxies/utilities: `proxy-logo`, `receipt-pdf`, `result-pdf` (PDF generation, likely via `@react-pdf/renderer`/`jspdf`), `razorpay-success-callback`.
- `src/app/visit` and `src/app/register-parent` — public, unauthenticated flows (visitor self-registration / parent self-registration).

## AI platform integration (school-ai)

The AI service is a *separate deployment* the browser talks to directly (not proxied through sms-backend), because streaming (SSE) and subscription checks need to reach the browser on any device, not just wherever sms-backend runs:
- **`src/lib/ai-auth.ts`**: `getAiToken()` exchanges the sms-backend session for a short-lived AI session JWT via `POST {API_URL}/ai/session`, cached in `sessionStorage` and refreshed ~5 min before expiry. `getAiHeaders()` builds headers for direct calls to `AI_API_URL` (also sets `Bypass-Tunnel-Reminder` for localtunnel-based local/staging setups).
- **`src/lib/ai-stream.ts`**: `streamAiResponse(path, body, opts)` POSTs to a school-ai SSE endpoint and parses `data: {...}` lines with `type` of `token` | `usage` | `done` | `error`.
- **`src/lib/ai-access.ts`**: `useAiAccess()` fetches `{AI_API_URL}/api/v1/subscription/status` and caches the plan/features/roles in `sessionStorage` for 5 minutes (`ai_access_v2`); distinguishes "no active plan" from `unreachable` (service down) so gates never show the wrong message.
- Env vars: `AI_API_URL` is the public/tunneled URL of school-ai reachable from the browser (not `localhost` in anything but same-machine dev); must be CORS-allowlisted on the school-ai side.

## Theming & design system — read `DESIGN.md` before adding UI

The visual language is **"Register & Ink"**: a warm walnut navigation rail against a cool-neutral paper canvas, brass as the single action colour, and pigments that each carry one fixed meaning (brass = brand/primary action, marigold = "act on this", sage = settled, vermilion = correction, lapis = informational only, iris = AI). `DESIGN.md` is the full spec — palette, type, the two signature elements, the component kernel, and the quality floor.

CSS custom properties are defined in `src/app/globals.css`, switched via a `data-theme` attribute (not a `.dark` class) using `next-themes`' `ThemeProvider` (`attribute="data-theme"`, themes: `light`, `dark`; the old `teal` theme is retired). Tailwind v4's `dark:` variant is remapped to key off `[data-theme="dark"]` via `@custom-variant dark (...)` at the top of `globals.css` — don't rely on the default `prefers-color-scheme` behavior. Semantic tokens (`--brand`, `--surface`, `--ink`, `--ink-muted`, `--line`, `--accent-*`) are what components should reference, not raw Tailwind color utilities.

Three gotchas that will silently break things:
- The raw palette block uses **`@theme static`**. Tailwind only emits theme variables it sees used in a *utility*, and the component classes further down `globals.css` reference them via plain `var()` — without `static`, `--font-display` and `--container-wide` resolve to nothing.
- The `next/font` variables must be applied to **`<html>`**, not `<body>`. `--font-sans` is declared at `:root` in terms of them, and a `var()` that can't resolve where it is *declared* computes to invalid and then inherits as empty — killing every font in the app.
- A **legacy bridge** at the bottom of `globals.css` re-points old raw utilities (`bg-white`, `text-slate-700`, `bg-blue-50`) onto the tokens so unmigrated pages still render in both themes. It is scaffolding — new code must not depend on it.

## UI components

`src/components/ui/**` is a shadcn/ui-style primitives folder (`components.json`: style `base-nova`, base color `neutral`, icon library `lucide`, path aliases `@/components`, `@/lib`, `@/hooks`, `@/components/ui`). Built on `@base-ui/react` + `class-variance-authority` + `tailwind-merge` (see `src/lib/utils.ts` for the `cn()` helper). Feature-level composite components live directly under `src/components/` (e.g. `AddStaffForm.tsx`, `ReceiptModal.tsx`, `PickupQRGenerator.tsx`/`PickupScanner.tsx`, `VisitorQRGenerator.tsx`/`VisitorScanPanel.tsx`), `src/components/dashboard/` holds shell chrome (`Sidebar`, `TopBar`, `BottomTabBar`), and `src/components/ai/` holds AI-specific building blocks (`FeatureGate`, `SmartFillBox`, `AiDisclaimer`, `DownloadPdfButton`).

## PWA / offline

The app is an installable PWA: `src/app/manifest.ts` (dynamic manifest), `ServiceWorkerRegistrar.tsx`, `PWAInstallBanner.tsx`, `SplashScreen.tsx` (fetches school branding at runtime for the splash), and push notifications via `src/lib/push-notifications.ts` + `@simplewebauthn/browser` for device-bound auth. `ServiceUnavailableBanner.tsx` listens for a `service-unavailable` `CustomEvent` dispatched by `authFetch` on HTTP 503.

## PDF generation

Two rendering paths coexist: `@react-pdf/renderer` document components (`src/lib/receipt-pdf-document.tsx`, `result-pdf-document.tsx`, `salary-slip-pdf.tsx`) used server-side by the `src/app/api/receipt-pdf` and `result-pdf` route handlers, and `jspdf`/`jspdf-autotable`/`html2canvas`/`html-to-image` for client-side export (`src/lib/pdf-export.ts`, `DownloadPdfButton.tsx`). `receipt-html-template.ts` provides an HTML-based receipt for print/preview separate from the PDF renderer.

## Path aliases

`@/*` maps to `src/*` (see `tsconfig.json`). TypeScript is `strict: true`; `noEmit: true` (Next.js handles the actual build/transpile). `babel-plugin-react-compiler` is a devDependency but `reactCompiler: false` in `next.config.ts` — the React Compiler is currently disabled, don't assume compiler-only optimizations are active.
