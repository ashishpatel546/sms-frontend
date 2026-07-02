import type { ReactNode } from "react";

/**
 * Themed informational banner used across pages to explain context or guide
 * the user. Supports light + dark modes via explicit dark: variants so the
 * component remains legible on any theme without extra globals.css patches.
 *
 * Usage:
 *   <InfoBanner title="About Payroll Runs" variant="indigo">
 *     Payroll is processed in two steps…
 *   </InfoBanner>
 */

type Variant = "blue" | "indigo" | "amber" | "green" | "red";

const STYLES: Record<Variant, { wrapper: string; title: string; body: string }> = {
  blue: {
    wrapper: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40",
    title:   "text-blue-900 dark:text-blue-200",
    body:    "text-blue-800 dark:text-blue-300",
  },
  indigo: {
    wrapper: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/40",
    title:   "text-indigo-900 dark:text-indigo-200",
    body:    "text-indigo-800 dark:text-indigo-300",
  },
  amber: {
    wrapper: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40",
    title:   "text-amber-900 dark:text-amber-200",
    body:    "text-amber-800 dark:text-amber-300",
  },
  green: {
    wrapper: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/40",
    title:   "text-green-900 dark:text-green-200",
    body:    "text-green-800 dark:text-green-300",
  },
  red: {
    wrapper: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40",
    title:   "text-red-900 dark:text-red-200",
    body:    "text-red-800 dark:text-red-300",
  },
};

export function InfoBanner({
  title,
  children,
  variant = "blue",
}: {
  title: string;
  children: ReactNode;
  variant?: Variant;
}) {
  const { wrapper, title: titleCls, body: bodyCls } = STYLES[variant];
  return (
    <div className={`rounded-lg border p-4 ${wrapper}`}>
      <h2 className={`text-sm font-semibold mb-1 ${titleCls}`}>{title}</h2>
      <div className={`text-xs leading-relaxed ${bodyCls}`}>{children}</div>
    </div>
  );
}
