"use client";

import { TriangleAlert } from "lucide-react";
import { AI_DISCLAIMER } from "@/lib/pdf-export";

/**
 * Renders a professional amber disclaimer banner informing users that the
 * displayed content was AI-generated.  Show this as soon as content loads.
 */
export function AiDisclaimer() {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex gap-3">
      <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
          AI-Generated Content
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
          {AI_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
