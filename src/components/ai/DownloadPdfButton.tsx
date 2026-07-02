"use client";

import { useState, RefObject } from "react";
import { Download } from "lucide-react";
import { generateAiPdf } from "@/lib/pdf-export";

interface DownloadPdfButtonProps {
  /** Ref to the element containing AI-generated markdown content. */
  contentRef: RefObject<HTMLElement | null>;
  /** Title for the PDF document (e.g. "Lesson Plan"). */
  title: string;
  /** Optional subtitle (e.g. "Grade 8 · Biology · Photosynthesis"). */
  subtitle?: string;
  /** Disable the button (e.g. while streaming is in progress). */
  disabled?: boolean;
}

/**
 * A button that captures AI-generated content via html2canvas and downloads
 * it as a properly formatted PDF with an AI disclaimer footer.
 */
export function DownloadPdfButton({
  contentRef,
  title,
  subtitle,
  disabled,
}: DownloadPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!contentRef.current || disabled || loading) return;
    setLoading(true);
    try {
      await generateAiPdf(contentRef.current, title, subtitle);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || loading}
      title="Download as PDF"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface text-xs font-medium text-ink-muted hover:text-ink hover:border-slate-300 dark:hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      {loading ? "Generating…" : "Download PDF"}
    </button>
  );
}
