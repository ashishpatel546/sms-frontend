"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { getSchoolSlug } from "@/lib/env";
import { setTokens, getDashboardRoute, getUser, markMustChangePasswordFlow } from "@/lib/auth";
import SplashScreen from "@/components/SplashScreen";
import { BorderBeam } from "@/components/ui/BorderBeam";
import {
  AlertCircle,
  BarChart2,
  CalendarCheck2,
  Eye,
  EyeOff,
  FileText,
  IndianRupee,
  Info,
  Loader2,
  Lock,
  Phone,
  UserRound,
  Users,
} from "lucide-react";

type Tab = "parent" | "staff";

/**
 * SIGN IN
 *
 * The one screen in the app that is mostly ink: a school day hasn't started
 * yet. The paper card floats on the ink field with the running light around its
 * edge — the app's way of saying "this is the live thing" — and everything else
 * on the screen stays quiet so the beam is the only thing moving.
 *
 * Two doors, not two apps: staff sign in with a mobile or email, parents with
 * the number the school already has on file.
 */
export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("staff");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Parent form
  const [mobile, setMobile] = useState("");
  // Staff form
  const [staffIdentifier, setStaffIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Where the splash should land when it finishes. Set only for users who are
  // already signed in; a ref so the splash's onDone never reads a stale value.
  const pendingRouteRef = useRef<string | null>(null);

  // Already signed in (staff or parent): keep the login form hidden, let the
  // splash play in full, and hand off straight to the right dashboard when it
  // ends — the sign-in screen is never seen.
  useEffect(() => {
    const user = getUser();
    if (user) {
      if (user.mustChangePassword) {
        markMustChangePasswordFlow();
        pendingRouteRef.current = "/change-password";
      } else {
        pendingRouteRef.current = getDashboardRoute(user.role);
      }
    } else {
      setIsCheckingAuth(false);
    }
  }, [router]);

  const handleSplashDone = () => {
    if (pendingRouteRef.current) router.replace(pendingRouteRef.current);
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const slug = getSchoolSlug();
      const res = await fetch(`${API_BASE_URL}/auth/login/parent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(slug ? { 'X-School-Slug': slug } : {}) },
        body: JSON.stringify({ mobile, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid mobile number or password");
      setTokens(data.access_token, data.refresh_token);
      setShowSplash(true);
      setTimeout(() => {
        if (data.user.mustChangePassword) {
          markMustChangePasswordFlow();
          router.push("/change-password");
        } else {
          router.push("/parent-dashboard");
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Invalid mobile number or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const slug = getSchoolSlug();
      const res = await fetch(`${API_BASE_URL}/auth/login/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(slug ? { 'X-School-Slug': slug } : {}) },
        body: JSON.stringify({ identifier: staffIdentifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid mobile number or password");
      setTokens(data.access_token, data.refresh_token);
      setShowSplash(true);
      setTimeout(() => {
        if (data.user.mustChangePassword) {
          markMustChangePasswordFlow();
          router.push("/change-password");
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Invalid mobile number or password");
    } finally {
      setIsLoading(false);
    }
  };

  const MODULES = [
    { Icon: CalendarCheck2, label: "Attendance" },
    { Icon: IndianRupee, label: "Fees & receipts" },
    { Icon: FileText, label: "Examinations" },
    { Icon: BarChart2, label: "Reports" },
    { Icon: Users, label: "Parent portal" },
  ];

  const inputClass =
    "h-11 w-full rounded-md border border-line-strong bg-surface-secondary pl-10 pr-3 text-[14px] text-ink transition-colors placeholder:text-ink-faint focus:border-brand focus:bg-surface focus:ring-3 focus:ring-brand/16 focus:outline-none";

  return (
    <div className="theme-bg min-h-dvh">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}

      {!isCheckingAuth && (
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl items-center px-3 py-6 sm:px-6 sm:py-10">
          <div className="relative grid w-full items-center gap-5 lg:grid-cols-[1fr_390px] lg:gap-0">

          {/* ── The walnut panel: what this is ─────────────────────────────
              A panel, not a screen — the paper canvas runs around it, and the
              sign-in card overlaps its right edge so the two halves of the
              design meet on the card itself. ──────────────────────────────── */}
          <div className="ink-field overflow-hidden rounded-2xl px-6 py-8 shadow-glass sm:px-9 sm:py-11 lg:py-14 lg:pr-32 lg:pl-11">
            <div className="flex items-center gap-3.5">
              <a
                href="https://colegios.in"
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/14 bg-white/10 p-1 backdrop-blur-md transition-colors hover:border-white/28 sm:size-16"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/colegios/colegios-logo-v2.png"
                  alt="Colegios"
                  className="size-full rounded-lg object-cover"
                />
              </a>
              <div className="min-w-0">
                <a
                  href="https://colegios.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-display text-[26px] leading-none font-semibold tracking-tight text-white transition-colors hover:text-marigold-300 sm:text-[30px]"
                >
                  Colegios
                </a>
                <p className="mt-1.5 font-mono text-[9.5px] tracking-[0.16em] text-brass-200/70 uppercase sm:text-[10.5px]">
                  School management system
                </p>
              </div>
            </div>

            <h1 className="mt-8 max-w-md font-display text-[27px] leading-[1.14] font-semibold tracking-tight text-white sm:mt-10 sm:text-[34px] lg:text-[38px]">
              Every register, ledger and mark sheet,
              <span className="text-marigold-300"> in one place.</span>
            </h1>

            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-brass-100/72 sm:mt-5 sm:text-[15.5px]">
              Attendance at the classroom door, fees at the counter, results at the end of term —
              recorded once and visible to everyone who needs them, from the principal&apos;s desk to
              a parent&apos;s phone.
            </p>

            {/* Modules — a plain list of what's inside, not a feature pitch */}
            <ul className="mt-7 flex flex-wrap gap-2 sm:mt-8">
              {MODULES.map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[12.5px] font-medium text-brass-100/90 backdrop-blur-sm"
                >
                  <Icon className="size-3.5 text-marigold-300" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* ── The sign-in card, overlapping the panel's edge ─────────── */}
          <div className="relative z-10 w-full lg:-ml-24">
            <div className="relative rounded-xl">
              {/* The one storm border on the screen */}
              <BorderBeam />

              {/* z-0 keeps the card *below* the storm ring (z-3) even though it
                  comes later in the DOM — otherwise it paints over the light. */}
              <div className="relative z-0 overflow-hidden rounded-xl bg-surface shadow-glass">
                <div className="px-6 pt-6 pb-1 sm:px-7">
                  <h2 className="font-display text-[23px] font-semibold text-ink">Sign in</h2>
                  <p className="mt-1 text-[13.5px] text-ink-muted">
                    Use the account your school set up for you.
                  </p>
                </div>

                {/* Which door */}
                <div
                  role="tablist"
                  aria-label="Account type"
                  className="mx-6 mt-4 flex gap-0.5 rounded-lg border border-line bg-surface-secondary p-0.5 sm:mx-7"
                >
                  {([
                    { id: "staff" as Tab, label: "Staff", Icon: UserRound },
                    { id: "parent" as Tab, label: "Parent", Icon: Users },
                  ]).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={activeTab === id}
                      onClick={() => { setActiveTab(id); setError(""); }}
                      suppressHydrationWarning
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-semibold transition-all ${
                        activeTab === id
                          ? "bg-surface text-brand shadow-soft"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="px-6 pt-5 pb-6 sm:px-7">
                  {activeTab === "staff" ? (
                    <form onSubmit={handleStaffLogin} className="space-y-4">
                      <div>
                        <label htmlFor="staff-id" className="eyebrow mb-1.5 block">
                          Mobile or email
                        </label>
                        <div className="relative">
                          <Phone
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
                          />
                          <input
                            id="staff-id"
                            type="text"
                            value={staffIdentifier}
                            onChange={e => setStaffIdentifier(e.target.value)}
                            required
                            autoComplete="username"
                            suppressHydrationWarning
                            placeholder="9876543210"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="staff-password" className="eyebrow mb-1.5 block">
                          Password
                        </label>
                        <div className="relative">
                          <Lock
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
                          />
                          <input
                            id="staff-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            suppressHydrationWarning
                            placeholder="••••••••"
                            className={`${inputClass} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            suppressHydrationWarning
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint transition-colors hover:bg-surface-secondary hover:text-ink"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>

                      {error && <FormError>{error}</FormError>}

                      <button
                        type="submit"
                        disabled={isLoading}
                        suppressHydrationWarning
                        className="mt-1 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand text-[14.5px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Signing in…
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </button>
                    </form>
                  ) : (
                    <>
                      <form onSubmit={handleParentLogin} className="space-y-4">
                        <div className="flex items-start gap-2.5 rounded-lg border border-accent-info-edge bg-accent-info-tint px-3.5 py-3 text-[12.5px] text-accent-info-deep">
                          <Info className="mt-px size-4 shrink-0" aria-hidden />
                          <span>
                            Sign in with the mobile number registered against your child&apos;s
                            account at the school.
                          </span>
                        </div>

                        <div>
                          <label htmlFor="parent-mobile" className="eyebrow mb-1.5 block">
                            Registered mobile number
                          </label>
                          <div className="relative">
                            <Phone
                              aria-hidden
                              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
                            />
                            <input
                              id="parent-mobile"
                              type="tel"
                              inputMode="numeric"
                              value={mobile}
                              onChange={e => setMobile(e.target.value)}
                              required
                              autoComplete="tel"
                              suppressHydrationWarning
                              placeholder="9876543210"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="parent-password" className="eyebrow mb-1.5 block">
                            Password
                          </label>
                          <div className="relative">
                            <Lock
                              aria-hidden
                              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
                            />
                            <input
                              id="parent-password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                              required
                              autoComplete="current-password"
                              suppressHydrationWarning
                              placeholder="••••••••"
                              className={`${inputClass} pr-11`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              suppressHydrationWarning
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint transition-colors hover:bg-surface-secondary hover:text-ink"
                            >
                              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </div>

                        {error && <FormError>{error}</FormError>}

                        <button
                          type="submit"
                          disabled={isLoading}
                          suppressHydrationWarning
                          className="mt-1 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand text-[14.5px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Signing in…
                            </>
                          ) : (
                            "Sign in"
                          )}
                        </button>
                      </form>

                      <p className="mt-4 text-center text-[13px] text-ink-muted">
                        First time here?{" "}
                        <a
                          href="/register-parent"
                          className="font-semibold text-brand transition-colors hover:underline"
                        >
                          Register as a parent
                        </a>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-[13px] text-ink-muted">
              Trouble signing in?{" "}
              <a href="/contact-us" className="font-semibold text-brand transition-colors hover:underline">
                Contact support
              </a>
            </p>

            <div className="mt-4 space-y-1 text-center font-mono text-[10.5px] text-ink-faint">
              <p>
                © {new Date().getFullYear()}{" "}
                <a href="https://colegios.in" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink-muted">
                  Colegios
                </a>
              </p>
              <p>
                Built by{" "}
                <a href="https://appme.in" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink-muted">
                  AppMe Soft Pvt Ltd
                </a>
              </p>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A sign-in failure, stated plainly and next to the form it belongs to. It
 * doesn't apologise and it doesn't guess which field was wrong — the server
 * deliberately won't say, and neither should the UI.
 */
function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-accent-danger-edge bg-accent-danger-tint px-3.5 py-2.5 text-[12.5px] font-medium text-accent-danger-deep"
    >
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
