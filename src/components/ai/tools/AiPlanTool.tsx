"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { clearAiAccessCache } from "@/lib/ai-access";
import {
  Sparkles, Zap, Calendar, RefreshCw, TrendingUp, ArrowUpCircle, Check, Crown, Cpu,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanInfo {
  name: string;
  display_name: string;
  plan_type: string;
  model_tier?: number;
  model_tier_label?: string;
}

interface SubStatus {
  has_active_plan: boolean;
  plan?: PlanInfo;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  billing_month: string;
  valid_till: string;
  days_remaining?: number;
  is_expiring_soon?: boolean;
  is_expired?: boolean;
  paid_by: string;
  can_upgrade: boolean;
  upgrade_options: string[];
  plan_monthly_credits?: number;
  is_first_period_prorated?: boolean;
}

interface AvailablePlan {
  id: string;
  name: string;
  display_name: string;
  plan_type: string;
  monthly_credits: number;
  price_inr: number;
  features: Record<string, boolean>;
  is_current: boolean;
  is_upgrade: boolean;
  model_tier?: number;
  model_tier_label?: string;
}

// ─── Razorpay types ───────────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: any) => void) => void;
    };
  }
}

const PLAN_GRADIENT: Record<string, string> = {
  free:         "from-slate-500 to-slate-600",
  silver:       "from-slate-400 to-slate-500",
  gold:         "from-amber-400 to-amber-600",
  diamond:      "from-cyan-400 to-violet-500",
  school_basic: "from-blue-400 to-blue-600",
  school_pro:   "from-indigo-500 to-purple-600",
  topup:        "from-green-400 to-emerald-600",
};

// Per-plan distinct card accent colours for upgrade cards
const PLAN_CARD_ACCENT: Record<string, { ring: string; btn: string; icon: string }> = {
  free:         { ring: "ring-slate-200", btn: "bg-gradient-to-r from-slate-500 to-slate-600", icon: "text-slate-500" },
  silver:       { ring: "ring-slate-300", btn: "bg-gradient-to-r from-slate-400 to-slate-500", icon: "text-slate-500" },
  gold:         { ring: "ring-amber-200",  btn: "bg-gradient-to-r from-amber-400 to-amber-600",  icon: "text-amber-500" },
  diamond:      { ring: "ring-cyan-200",   btn: "bg-gradient-to-r from-cyan-400 to-violet-500",  icon: "text-cyan-500" },
  school_basic: { ring: "ring-blue-200",   btn: "bg-gradient-to-r from-blue-400 to-blue-600",   icon: "text-blue-500" },
  school_pro:   { ring: "ring-indigo-200", btn: "bg-gradient-to-r from-indigo-500 to-purple-600", icon: "text-indigo-500" },
  topup:        { ring: "ring-green-200",  btn: "bg-gradient-to-r from-green-400 to-emerald-600", icon: "text-green-500" },
};

const PLAN_BADGE_COLOR: Record<string, string> = {
  free:         "bg-slate-100 text-slate-600",
  silver:       "bg-slate-200 text-slate-700",
  gold:         "bg-amber-100 text-amber-700",
  diamond:      "bg-cyan-100 text-cyan-700",
  school_basic: "bg-blue-100 text-blue-700",
  school_pro:   "bg-indigo-100 text-indigo-700",
  topup:        "bg-green-100 text-green-700",
};

const MODEL_TIERS: Record<number, string> = {
  1: "Basic",
  2: "Standard",
  3: "Advanced",
};

// Distinct, eye-catching colours per AI model tier so users can see at a
// glance how plans differ in AI quality (cycles for tiers beyond 3).
const TIER_BADGE_COLORS = [
  "bg-slate-100 text-slate-700 ring-1 ring-slate-300",
  "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
  "bg-violet-100 text-violet-700 ring-1 ring-violet-300",
  "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
  "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
  "bg-pink-100 text-pink-700 ring-1 ring-pink-300",
];
function tierBadgeClass(tier?: number): string {
  const t = tier ?? 1;
  return TIER_BADGE_COLORS[(t - 1) % TIER_BADGE_COLORS.length] ?? TIER_BADGE_COLORS[0];
}

const FEATURE_LABELS: Record<string, string> = {
  chat:           "AI Chat / Tutoring",
  quiz:           "Practice Quiz",
  explain_topic:  "Explain Topic",
  lesson_plan:    "Lesson Plan Generator",
  question_paper: "Question Paper Generator",
  worksheet:      "Worksheet Generator",
  assignment:     "Assignment Suggestions",
  learning_path:  "Personalized Learning Path",
  teacher_chat:   "Teacher Chat",
};

// ─── Razorpay loader ──────────────────────────────────────────────────────────
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function AiPlanTool() {
  const [status, setStatus]             = useState<SubStatus | null>(null);
  const [plans, setPlans]               = useState<AvailablePlan[]>([]);
  const [topupPlans, setTopupPlans]     = useState<AvailablePlan[]>([]);
  const [loading, setLoading]           = useState(true);
  const [plansLoading, setPlansLoading] = useState(false);
  const [error, setError]               = useState("");
  const [showPlans, setShowPlans]       = useState(false);
  const [showTopup, setShowTopup]       = useState(false);
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [prorationNote, setProrationNote] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/ai/subscription-status`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Error ${res.status}`);
      }
      const json = await res.json();
      const raw = json?.data ?? json;
      setStatus({
        ...raw,
        credits_total:     raw.credits_total     ?? 0,
        credits_used:      raw.credits_used      ?? 0,
        credits_remaining: raw.credits_remaining ?? 0,
        can_upgrade:       raw.can_upgrade       ?? false,
        upgrade_options:   raw.upgrade_options   ?? [],
      });
      // This status check is always fresh (bypasses the FeatureGate cache),
      // so it's the source of truth — drop any stale "no active plan" result
      // FeatureGate may have cached before this plan became active.
      clearAiAccessCache();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/ai/plans`);
      if (!res.ok) return;
      const json = await res.json();
      const planData = json?.data ?? json;
      const all: AvailablePlan[] = planData?.individual_plans ?? planData ?? [];
      setPlans(all.filter((p) => p.plan_type !== "topup"));
      setTopupPlans(all.filter((p) => p.plan_type === "topup"));
    } catch {
      // non-fatal
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleShowPlans = () => {
    setShowPlans(true);
    if (plans.length === 0) loadPlans();
  };

  const handleShowTopup = () => {
    setShowTopup(true);
    if (topupPlans.length === 0) loadPlans();
  };

  // ─── Plan selection handler ───────────────────────────────────────────────
  const handleBuyPlan = useCallback(async (plan: AvailablePlan) => {
    if (payingPlanId) return;
    setPayingPlanId(plan.id);
    setError("");

    try {
      // ── Free plan: no payment needed ──────────────────────────────────────
      if (plan.price_inr === 0 || plan.name === "free") {
        const res = await authFetch(`${API_BASE_URL}/ai/claim-free`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? "Could not activate free plan.");
        }
        await loadStatus();
        setShowPlans(false);
        return;
      }

      // ── Paid plan: Razorpay checkout ──────────────────────────────────────
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Failed to load payment gateway. Please refresh and try again.");

      // 1. Create order on backend (sms-backend → school-ai)
      const billingMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const orderRes = await authFetch(`${API_BASE_URL}/ai/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, billing_month: billingMonth }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error(body?.message ?? "Could not create payment order.");
      }
      const orderJson = await orderRes.json();
      const orderData = orderJson?.data ?? orderJson;

      // Surface proration info for mid-month signups before opening checkout
      const preview = orderData.subscription_preview;
      let description = `${plan.display_name} Plan — ${billingMonth}`;
      if (preview?.is_prorated) {
        const note = `Prorated for ${preview.days_remaining} of ${preview.days_in_month} days — ₹${orderData.amount_inr} now (full price ₹${preview.full_price_inr}/mo from the 1st)`;
        setProrationNote(note);
        description = `${plan.display_name} Plan — ${note}`;
      } else {
        setProrationNote(null);
      }

      // 2. Open Razorpay checkout — key comes from the create-order response
      // (always matches the account that created the order; NEXT_PUBLIC_ vars
      // are inlined at CI build time where no env is set, so they're only a
      // local-dev fallback).
      const rzpKey = orderData.razorpay_key_id ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: rzpKey,
          amount: orderData.amount_paise,
          currency: orderData.currency ?? "INR",
          name: "School AI",
          description,
          order_id: orderData.razorpay_order_id ?? orderData.order_id ?? orderData.id,
          theme: { color: "#6d28d9" },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled.")),
          },
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              // 3. Verify payment
              const verifyRes = await authFetch(`${API_BASE_URL}/ai/verify-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
              });
              if (!verifyRes.ok) {
                const body = await verifyRes.json().catch(() => ({}));
                throw new Error(body?.message ?? "Payment verification failed.");
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.open();
      });

      // 4. Refresh subscription status after successful payment
      await loadStatus();
      setShowPlans(false);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed.";
      if (msg !== "Payment cancelled.") setError(msg);
    } finally {
      setPayingPlanId(null);
      setProrationNote(null);
    }
  }, [payingPlanId, loadStatus]);

  const pct = status
    ? Math.min(100, Math.round((status.credits_used / (status.credits_total || 1)) * 100))
    : 0;

  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  const gradientClass =
    PLAN_GRADIENT[status?.plan?.name ?? "free"] ?? "from-violet-500 to-indigo-600";

  const badgeClass =
    PLAN_BADGE_COLOR[status?.plan?.name ?? "free"] ?? "bg-violet-100 text-violet-700";

  // When user has no active plan: show all plans (including free).
  // When user already has a plan and wants to upgrade: exclude free and current plan.
  const upgradeablePlans = plans.filter((p) => {
    if (p.is_current) return false;
    if (status?.has_active_plan && (p.price_inr === 0 || p.name === "free")) return false;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">My AI Plan</h1>
          <p className="text-sm text-ink-muted">Your subscription &amp; usage for this month</p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="ml-auto p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-secondary transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Expiry Warning ─────────────────────────────────────────── */}
      {status?.is_expired && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span><strong>Plan Expired.</strong> Subscribe again to continue using AI features. Unused credits have expired.</span>
          <button onClick={handleShowPlans} className="bg-red-600 hover:bg-red-700 transition-colors text-white px-3 py-1.5 rounded-lg font-medium text-xs">Renew</button>
        </div>
      )}
      {status?.is_expiring_soon && !status?.is_expired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex justify-between items-center">
          <span>⚠️ <strong>Plan expires in {status.days_remaining} days.</strong> Renew soon to avoid interruption.</span>
          <button onClick={handleShowPlans} className="bg-amber-600 hover:bg-amber-700 transition-colors text-white px-3 py-1.5 rounded-lg font-medium text-xs">Renew Early</button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────── */}
      {loading && !status && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-6 animate-pulse space-y-3">
          <div className="h-6 w-32 bg-slate-200 dark:bg-white/10 rounded-lg" />
          <div className="h-4 w-full bg-slate-200 dark:bg-white/10 rounded-lg" />
          <div className="h-4 w-3/4 bg-slate-200 dark:bg-white/10 rounded-lg" />
        </div>
      )}

      {status && (
        <>
          {/* ── No active plan banner ─────────────────────────────── */}
          {!status.has_active_plan && (
            <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/20 px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <p className="font-semibold text-violet-800 dark:text-violet-300 text-sm">You don&apos;t have an active plan</p>
              </div>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                You&apos;re currently using limited free features. Upgrade to a paid plan to unlock AI-powered lesson plans, question papers, worksheets and more.
              </p>
              {!showPlans && (
                <button
                  onClick={handleShowPlans}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" /> View Plans
                </button>
              )}
            </div>
          )}

          {/* ── Plan card (only when subscribed) ──────────────────── */}
          {status.has_active_plan && <div className={`rounded-2xl bg-linear-to-br ${gradientClass} p-5 text-white shadow-lg`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeClass}`}>
                    {status.plan?.name ?? "free"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">
                    <Cpu className="w-3 h-3" />
                    AI Tier: {status.plan?.model_tier_label ?? MODEL_TIERS[(status.plan?.model_tier as 1 | 2 | 3) ?? 1]}
                  </span>
                  {status.paid_by === "school" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">
                      School-paid
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold">{status.plan?.display_name ?? "Free"} Plan</h2>
                <p className="text-sm opacity-80 capitalize mt-0.5">
                  {status.plan?.plan_type ?? "individual"} · Resets 1st of each month
                </p>
              </div>
              <Crown className="w-8 h-8 opacity-40 shrink-0" />
            </div>

            {/* Credits progress */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold opacity-90">
                <span>{status.credits_remaining.toLocaleString()} credits remaining</span>
                <span>{status.credits_total.toLocaleString()} total</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] opacity-75">
                <span>{status.credits_used.toLocaleString()} used ({pct}%)</span>
                <span>
                  Valid till{" "}
                  {status.valid_till
                    ? new Date(status.valid_till).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    : "end of month"}
                </span>
              </div>
              {status.is_first_period_prorated && !!status.plan_monthly_credits && (
                <div className="mt-1 text-[11px] opacity-80 bg-white/10 rounded-lg px-2 py-1.5">
                  First-cycle credits prorated for the remaining days this month ({status.credits_total.toLocaleString()} of {status.plan_monthly_credits.toLocaleString()}). Full credits from the 1st.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/20 text-[10px] font-medium opacity-80">
              Unused credits expire at the end of the billing period and do not carry over.
            </div>

            {/* Upgrade CTA */}
            {status.can_upgrade && !showPlans && (
              <button
                onClick={handleShowPlans}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Upgrade Plan
              </button>
            )}
          </div>}

          {/* ── Stats grid ────────────────────────────────────────── */}
          {status.has_active_plan && <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Credits Used",  value: status.credits_used.toLocaleString(),      icon: <Zap className="w-4 h-4 text-amber-500" /> },
              { label: "Credits Left",  value: status.credits_remaining.toLocaleString(), icon: <TrendingUp className="w-4 h-4 text-emerald-500" /> },
              {
                label: "Credits Expire On",
                value: status.valid_till
                  ? new Date(status.valid_till).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : status.billing_month,
                icon: <Calendar className="w-4 h-4 text-violet-500" />,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-3">
                <div className="flex items-center gap-1.5 text-ink-muted mb-1.5">
                  {s.icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="font-bold text-ink">{s.value}</p>
              </div>
            ))}
          </div>}

          {/* ── Usage bar ─────────────────────────────────────────── */}
          {status.has_active_plan && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Monthly Usage</p>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-white/10">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
                <span>{pct}% of {status.credits_total.toLocaleString()} credits used</span>
                {pct >= 80 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Running low — consider upgrading</span>
                )}
              </div>
            </div>
          )}

          {/* ── Top Up Credits ────────────────────────────────────── */}
          {!showTopup ? (
            <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-colors ${
              status.has_active_plan
                ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20"
                : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface opacity-70"
            }`}>
              <div>
                <p className={`text-sm font-semibold ${status.has_active_plan ? "text-emerald-800 dark:text-emerald-300" : "text-slate-500"}`}>
                  Top Up Credits
                </p>
                {status.has_active_plan ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Add extra credits to your current plan without changing your subscription.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Subscribe to a plan first to be able to top up your credits.
                  </p>
                )}
              </div>
              <div className="relative group shrink-0">
                <button
                  onClick={status.has_active_plan ? handleShowTopup : undefined}
                  disabled={!status.has_active_plan}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-opacity whitespace-nowrap
                    ${status.has_active_plan
                      ? "bg-gradient-to-r from-green-400 to-emerald-600 hover:opacity-90 cursor-pointer"
                      : "bg-slate-300 dark:bg-slate-600 cursor-not-allowed"
                    }`}
                >
                  <Zap className="w-3.5 h-3.5" /> Top Up
                </button>
                {!status.has_active_plan && (
                  <div className="absolute bottom-full right-0 mb-2 w-52 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div className="bg-slate-800 text-white text-xs rounded-xl px-3 py-2 shadow-lg leading-relaxed">
                      You need an active plan to top up credits.
                      <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" /> Top Up Packs
                </h2>
                <div className="flex items-center gap-2">
                  {plansLoading && <RefreshCw className="w-4 h-4 animate-spin text-ink-muted" />}
                  <button onClick={() => setShowTopup(false)} className="text-xs text-ink-muted hover:text-ink">Hide</button>
                </div>
              </div>

              {topupPlans.length === 0 && !plansLoading && (
                <p className="text-sm text-ink-muted text-center py-3">No top-up packs available right now.</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topupPlans.map((plan) => {
                  const isPaying = payingPlanId === plan.id;
                  return (
                    <div key={plan.id} className="rounded-xl ring-1 ring-emerald-200 dark:ring-emerald-900/50 p-3 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
                      <div>
                        <p className="text-sm font-semibold text-ink">{plan.display_name}</p>
                        <p className="text-xs text-ink-muted">+{plan.monthly_credits.toLocaleString()} credits</p>
                        <p className="text-base font-bold text-emerald-600 mt-0.5">₹{plan.price_inr.toLocaleString("en-IN")}</p>
                      </div>
                      <button
                        onClick={() => handleBuyPlan(plan)}
                        disabled={!!payingPlanId}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-400 to-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                      >
                        {isPaying ? <><RefreshCw className="w-3 h-3 animate-spin" /> Processing…</> : <><Zap className="w-3 h-3" /> Buy</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Available plans ──────────────────────────────────── */}
          {showPlans && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-ink">
                  {status.has_active_plan ? "Upgrade Options" : "Available Plans"}
                </h2>
                <div className="flex items-center gap-2">
                  {plansLoading && <RefreshCw className="w-4 h-4 animate-spin text-ink-muted" />}
                  <button onClick={() => setShowPlans(false)} className="text-xs text-ink-muted hover:text-ink">Hide</button>
                </div>
              </div>

              {upgradeablePlans.length === 0 && !plansLoading && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface px-4 py-6 text-center space-y-1">
                  <p className="text-sm font-medium text-ink">You&apos;re on the best available plan!</p>
                  <p className="text-xs text-ink-muted">No higher plans are available for your account.</p>
                </div>
              )}

              {upgradeablePlans.map((plan) => {
                const accent = PLAN_CARD_ACCENT[plan.name] ?? PLAN_CARD_ACCENT.school_pro;
                const isPaying = payingPlanId === plan.id;
                return (
                  <div key={plan.id} className={`rounded-2xl ring-1 ${accent.ring} bg-white dark:bg-surface p-4 space-y-3 transition-shadow hover:shadow-md`}>
                    {isPaying && prorationNote && (
                      <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-xs px-3 py-2">
                        {prorationNote}
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${PLAN_BADGE_COLOR[plan.name] ?? "bg-violet-100 text-violet-700"}`}>
                            {plan.display_name}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${tierBadgeClass(plan.model_tier)}`}>
                            <Cpu className="w-3 h-3" />
                            {plan.model_tier_label ?? MODEL_TIERS[(plan.model_tier as 1 | 2 | 3) ?? 1] ?? `Tier ${plan.model_tier}`} AI
                          </span>
                        </div>
                        <p className="mt-1.5 text-2xl font-bold text-ink">
                          {plan.price_inr === 0 ? "Free" : `₹${plan.price_inr.toLocaleString("en-IN")}`}
                          {plan.price_inr > 0 && <span className="text-sm font-normal text-ink-muted">/month</span>}
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5">{plan.monthly_credits.toLocaleString()} credits/month</p>
                      </div>
                      <button
                        onClick={() => plan.price_inr === 0 ? handleBuyPlan(plan) : handleBuyPlan(plan)}
                        disabled={!!payingPlanId}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold ${accent.btn} hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap`}
                      >
                        {isPaying ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing…</>
                        ) : plan.price_inr === 0 ? (
                          <><Check className="w-3.5 h-3.5" /> Start Free</>
                        ) : (
                          <><ArrowUpCircle className="w-3.5 h-3.5" /> Buy Now</>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(plan.features).filter(([, v]) => v).map(([key]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-ink-muted">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          {FEATURE_LABELS[key] ?? key.replace(/_/g, " ")}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {upgradeablePlans.length > 0 && (
                <p className="text-xs text-ink-muted text-center">
                  Need a school-wide plan?{" "}
                  <a href="mailto:support@colegios.in" className="underline underline-offset-2">Contact us</a>.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
