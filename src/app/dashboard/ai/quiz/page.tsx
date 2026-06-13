"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Square, Zap } from "lucide-react";
import { streamAiResponse, SseUsage } from "@/lib/ai-stream";
import { FeatureGate } from "@/components/ai/FeatureGate";

const GRADES = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const DIFFICULTIES = ["Easy","Medium","Hard"];

export default function QuizPage() {
  const abortRef = useRef<AbortController | null>(null);

  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Medium");
  const [language, setLanguage] = useState("en");

  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<SseUsage | null>(null);
  const [error, setError] = useState("");

  const canGenerate = topic.trim().length > 3 && subject.trim().length > 1;

  const generate = async () => {
    setOutput("");
    setUsage(null);
    setError("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    await streamAiResponse(
      "/api/v1/student/practice-quiz",
      { topic: topic.trim(), grade, subject: subject.trim(), question_count: questionCount, difficulty, language },
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
    <FeatureGate feature="practice_quiz">
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Practice Quiz</h1>
          <p className="text-sm text-ink-muted">Test your understanding with AI-generated questions</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
            Topic <span className="text-red-500">*</span>
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The Mughal Empire"
            maxLength={300}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Subject *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. History"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">No. of Questions</label>
            <input
              type="number"
              min={3}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Difficulty</label>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    difficulty === d
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 dark:bg-surface-secondary text-ink-muted hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Language</label>
          <div className="flex gap-2">
            {["en", "hi", "hinglish"].map((l) => (
              <button key={l} onClick={() => setLanguage(l)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${language === l ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-surface-secondary text-ink-muted hover:text-ink"}`}>
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
            <button onClick={generate} disabled={!canGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
              <Sparkles className="w-4 h-4" /> Generate Quiz
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {(output || streaming) && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-ink">Practice Quiz</span>
            {streaming && <span className="flex items-center gap-1.5 text-xs text-violet-500"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />Generating...</span>}
            {usage && <span className="flex items-center gap-1 text-xs text-ink-muted"><Zap className="w-3 h-3 text-amber-500" />{usage.credits_charged} credits · {usage.credits_remaining} remaining</span>}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
          {streaming && <span className="inline-block w-1 h-4 bg-violet-500 animate-pulse ml-0.5 rounded-sm" />}
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
