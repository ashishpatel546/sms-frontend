"use client";
/**
 * FeatureGate — wraps an AI feature page.
 * Shows the feature if the user's plan includes it; otherwise shows a
 * lock screen with an upgrade prompt.
 */
import Link from "next/link";
import { Lock, ArrowUpCircle, Sparkles } from "lucide-react";
import { useAiAccess } from "@/lib/ai-access";

const FEATURE_LABELS: Record<string, string> = {
  chat:           "AI Chat / Student Tutor",
  quiz:           "Practice Quiz",
  explain_topic:  "Explain Topic",
  lesson_plan:    "Lesson Plan Generator",
  question_paper: "Question Paper Generator",
  worksheet:      "Worksheet Generator",
  assignment:     "Assignment Suggestions",
  learning_path:  "Personalized Learning Path",
  teacher_chat:   "Teacher AI Chat",
};

interface Props {
  feature: string;
  children: React.ReactNode;
}

export function FeatureGate({ feature, children }: Props) {
  const access = useAiAccess();

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (access.loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-white/10 rounded-xl" />
        <div className="h-4 w-full bg-slate-200 dark:bg-white/10 rounded-lg" />
        <div className="h-4 w-3/4 bg-slate-200 dark:bg-white/10 rounded-lg" />
        <div className="h-40 w-full bg-slate-200 dark:bg-white/10 rounded-2xl" />
      </div>
    );
  }

  // ── Role check (configurable from hub admin) ───────────────────────────────
  // If the feature has an allowed-roles list and the user has none of them,
  // show a role message instead of an upgrade prompt.
  const allowedRoles = access.featureRoles[feature];
  const roleBlocked =
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    access.roles.length > 0 &&
    !access.roles.some((r) => allowedRoles.includes(r));

  if (roleBlocked) {
    const label = FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ");
    const roleText = allowedRoles
      .map((r) => (r === "student" ? "students & parents" : `${r}s`))
      .join(" and ");
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-ink">Not available for your role</h2>
        <p className="text-sm text-ink-muted mt-1">{label} is available for {roleText}.</p>
      </div>
    );
  }

  const hasAccess = access.hasActivePlan && access.features[feature] === true;

  // ── Feature available ──────────────────────────────────────────────────────
  if (hasAccess) return <>{children}</>;

  // ── Feature locked ─────────────────────────────────────────────────────────
  const featureLabel = FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ");
  const noActivePlan = !access.hasActivePlan;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-6">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shadow-sm">
        <Lock className="w-7 h-7 text-amber-500" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-ink">{featureLabel}</h2>
        {noActivePlan ? (
          <p className="text-sm text-ink-muted leading-relaxed max-w-sm">
            You don&apos;t have an active plan. Subscribe to unlock this and other
            AI-powered features.
          </p>
        ) : (
          <p className="text-sm text-ink-muted leading-relaxed max-w-sm">
            Your current{" "}
            <span className="font-semibold text-ink">{access.planDisplayName}</span>{" "}
            plan doesn&apos;t include this feature. Upgrade to unlock it.
          </p>
        )}
      </div>

      {/* CTA */}
      <Link
        href="/dashboard/ai/subscription"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
      >
        <ArrowUpCircle className="w-4 h-4" />
        {noActivePlan ? "View Plans" : "Upgrade Plan"}
      </Link>

      {/* Blurred preview */}
      <div className="mt-2 w-full rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white/90 dark:via-slate-900/40 dark:to-slate-900/90 z-10" />
        <div className="space-y-3 blur-[3px] opacity-50 select-none pointer-events-none">
          <div className="h-4 w-2/3 bg-slate-300 dark:bg-white/20 rounded" />
          <div className="h-4 w-full bg-slate-300 dark:bg-white/20 rounded" />
          <div className="h-4 w-5/6 bg-slate-300 dark:bg-white/20 rounded" />
          <div className="h-10 w-full bg-slate-300 dark:bg-white/20 rounded-xl" />
          <div className="h-4 w-3/4 bg-slate-300 dark:bg-white/20 rounded" />
          <div className="h-10 w-32 bg-violet-200 dark:bg-violet-900/40 rounded-xl" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 shadow-lg rounded-xl px-4 py-2.5 text-sm font-semibold text-ink border border-slate-100 dark:border-white/10">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Upgrade to unlock
          </div>
        </div>
      </div>
    </div>
  );
}
