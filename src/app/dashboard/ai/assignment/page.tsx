"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Square, Zap } from "lucide-react";
import { streamAiResponse, SseUsage } from "@/lib/ai-stream";
import { FeatureGate } from "@/components/ai/FeatureGate";
import { AiDisclaimer } from "@/components/ai/AiDisclaimer";
import { DownloadPdfButton } from "@/components/ai/DownloadPdfButton";
import { AiValueBanner } from "@/components/ai/AiValueBanner";
import { SmartFillBox, ExtractedFields, applyBaseFields, useAutoFillHighlight } from "@/components/ai/SmartFillBox";

const GRADES = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const BOARDS = ["CBSE","ICSE","State Board","IB","IGCSE"];

export default function AssignmentPage() {
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState("");
  const [board, setBoard] = useState("CBSE");
  const [language, setLanguage] = useState("en");

  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<SseUsage | null>(null);
  const [error, setError] = useState("");

  const { ring, flash } = useAutoFillHighlight();

  const applyExtracted = (f: ExtractedFields) => {
    const applied = applyBaseFields(f, { setTopic, setSubject, setGrade, setBoard, setLanguage }, GRADES, BOARDS);
    flash(applied);
  };

  const canGenerate = topic.trim().length > 3 && subject.trim().length > 1;

  const generate = async () => {
    setOutput("");
    setUsage(null);
    setError("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    await streamAiResponse(
      "/api/v1/teacher/assignment",
      { topic: topic.trim(), grade, subject: subject.trim(), board, language },
      {
        onToken: (t) => setOutput((p) => p + t),
        onDone: (u) => { setUsage(u); setStreaming(false); },
        onError: (msg) => { setError(msg); setStreaming(false); },
        signal: ctrl.signal,
      },
    );
  };

  const stop = () => { abortRef.current?.abort(); };

  return (
    <FeatureGate feature="assignment">
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">Assignment Suggestions</h1>
          <p className="text-sm text-ink-muted">Get creative, curriculum-aligned assignment ideas</p>
        </div>
      </div>

      <AiValueBanner />

      <SmartFillBox tool="assignment" onExtracted={applyExtracted} />

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
            Topic <span className="text-red-500">*</span>
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The French Revolution"
            maxLength={200}
            className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("topic")}`}
          />
          <p className="mt-1 text-xs text-ink-muted text-right">{topic.length}/200</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Subject *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. History"
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("subject")}`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("grade")}`}
            >
              {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Board</label>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("board")}`}
          >
            {BOARDS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Language</label>
          <div className={`flex gap-2 w-fit rounded-xl${ring("language")}`}>
            {["en", "hi", "hinglish"].map((l) => (
              <button key={l} onClick={() => setLanguage(l)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${language === l ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-surface-secondary text-ink-muted hover:text-ink"}`}>
                {l === "en" ? "English" : l === "hi" ? "Hindi" : "Hinglish"}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1">
          {streaming ? (
            <button onClick={stop} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button onClick={generate} disabled={!canGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
              <Sparkles className="w-4 h-4" /> Generate Ideas
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {(output || streaming) && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink">Assignment Ideas</span>
              <div className="flex items-center gap-3">
                {streaming && <span className="flex items-center gap-1.5 text-xs text-indigo-500"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />Generating...</span>}
                {usage && <span className="flex items-center gap-1 text-xs text-ink-muted"><Zap className="w-3 h-3 text-amber-500" />{usage.credits_charged} credits · {usage.credits_remaining} remaining</span>}
                <DownloadPdfButton
                  contentRef={outputRef}
                  title="Assignment Ideas"
                  subtitle={`${subject} · Grade ${grade} · ${topic}`}
                  disabled={streaming || !output}
                />
              </div>
            </div>
            <div ref={outputRef} className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-surface p-2 rounded-lg">
              <ReactMarkdown>{output}</ReactMarkdown>
            </div>
            {streaming && <span className="inline-block w-1 h-4 bg-indigo-500 animate-pulse ml-0.5 rounded-sm" />}
          </div>
          <AiDisclaimer />
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
