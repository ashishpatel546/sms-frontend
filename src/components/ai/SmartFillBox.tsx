"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { postAiJson } from "@/lib/ai-json";

export interface ExtractedFields {
  topic: string | null;
  grade: string | null;
  subject: string | null;
  board: string | null;
  language: string | null;
  duration_minutes: number | null;
  total_marks: number | null;
  question_types: string[] | null;
  difficulty: string | null;
  worksheet_type: string | null;
}

export type SmartFillTool = "lesson_plan" | "question_paper" | "worksheet" | "assignment";

const PLACEHOLDERS: Record<SmartFillTool, string> = {
  lesson_plan: "e.g. 45 minute lesson on photosynthesis for class 8 CBSE in Hindi",
  question_paper: "e.g. 40 marks physics paper on laws of motion for class 10, MCQ and short answers, hard",
  worksheet: "e.g. worksheet on fractions for class 6 CBSE in Hindi, revision type",
  assignment: "e.g. assignment ideas on the water cycle for class 7 science",
};

interface SmartFillBoxProps {
  tool: SmartFillTool;
  onExtracted: (fields: ExtractedFields) => void;
}

/**
 * Smart Auto-Fill: the teacher describes what they need in one sentence and
 * a quick (free) AI call fills the form fields below. Purely additive — on
 * any failure the manual form is left untouched.
 */
export function SmartFillBox({ tool, onExtracted }: SmartFillBoxProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = text.trim().length >= 5 && !loading;

  const autoFill = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const fields = await postAiJson<ExtractedFields>("/api/v1/teacher/extract-params", {
        tool,
        text: text.trim(),
      });
      onExtracted(fields);
    } catch {
      setError("Couldn't auto-fill — please fill the form manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      autoFill();
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-2.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
        <Wand2 className="w-3.5 h-3.5" />
        Smart Auto-Fill — just describe what you need
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        rows={2}
        maxLength={300}
        placeholder={PLACEHOLDERS[tool]}
        className="w-full rounded-xl border border-violet-200 dark:border-violet-500/20 bg-white dark:bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">{text.length}/300 · Free — no credits used</p>
        <button
          onClick={autoFill}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {loading ? "Understanding..." : "Auto-fill form"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/** Briefly highlights form fields that were just auto-filled. */
export function useAutoFillHighlight() {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const flash = (fields: string[]) => {
    if (fields.length === 0) return;
    setHighlighted(new Set(fields));
    setTimeout(() => setHighlighted(new Set()), 2500);
  };

  const isHighlighted = (field: string) => highlighted.has(field);
  const ring = (field: string) =>
    isHighlighted(field) ? " ring-2 ring-violet-400/70 transition-shadow" : "";

  return { isHighlighted, ring, flash };
}

export interface BaseFieldSetters {
  setTopic: (v: string) => void;
  setSubject: (v: string) => void;
  setGrade: (v: string) => void;
  setBoard: (v: string) => void;
  setLanguage: (v: string) => void;
}

const LANGUAGES = ["en", "hi", "hinglish"];

/**
 * Applies the base fields (topic/subject/grade/board/language) shared by all
 * generator pages. Only non-null values that pass membership checks are set.
 * Returns the names of fields actually applied (for highlight flashing).
 */
export function applyBaseFields(
  f: ExtractedFields,
  setters: BaseFieldSetters,
  grades: string[],
  boards: string[],
): string[] {
  const applied: string[] = [];
  if (f.topic) { setters.setTopic(f.topic); applied.push("topic"); }
  if (f.subject) { setters.setSubject(f.subject); applied.push("subject"); }
  if (f.grade && grades.includes(f.grade)) { setters.setGrade(f.grade); applied.push("grade"); }
  if (f.board && boards.includes(f.board)) { setters.setBoard(f.board); applied.push("board"); }
  if (f.language && LANGUAGES.includes(f.language)) { setters.setLanguage(f.language); applied.push("language"); }
  return applied;
}
