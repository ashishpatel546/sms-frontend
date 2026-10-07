"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import { Sparkles, Square, Zap } from "lucide-react";
import { streamAiResponse, SseUsage } from "@/lib/ai-stream";
import { FeatureGate } from "@/components/ai/FeatureGate";
import { AiDisclaimer } from "@/components/ai/AiDisclaimer";
import { DownloadPdfButton } from "@/components/ai/DownloadPdfButton";
import { AiValueBanner } from "@/components/ai/AiValueBanner";
import { SmartFillBox, ExtractedFields, applyBaseFields, useAutoFillHighlight } from "@/components/ai/SmartFillBox";
import NumberInput from "@/components/ui/NumberInput";

const GRADES = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const BOARDS = ["CBSE","ICSE","State Board","IB","IGCSE"];
const DIFFICULTIES = ["Easy","Medium","Hard","Mixed"] as const;
const Q_TYPES = ["MCQ","Short Answer","Long Answer","Fill in the Blanks","True/False","Match the Following"] as const;

export default function QuestionPaperPage() {
  const t = useTranslations("ai");
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState("");
  const [board, setBoard] = useState("CBSE");
  const [totalMarks, setTotalMarks] = useState(40);
  const [selectedQTypes, setSelectedQTypes] = useState<string[]>(["MCQ","Short Answer"]);
  const [difficulty, setDifficulty] = useState("Mixed");
  const [language, setLanguage] = useState("en");

  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<SseUsage | null>(null);
  const [error, setError] = useState("");

  const toggleQType = (t: string) =>
    setSelectedQTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const { ring, flash } = useAutoFillHighlight();

  const applyExtracted = (f: ExtractedFields) => {
    const applied = applyBaseFields(f, { setTopic, setSubject, setGrade, setBoard, setLanguage }, GRADES, BOARDS);
    if (f.total_marks) {
      setTotalMarks(f.total_marks);
      applied.push("totalMarks");
    }
    if (f.question_types && f.question_types.length > 0) {
      const filtered = f.question_types.filter((qt) => (Q_TYPES as readonly string[]).includes(qt));
      if (filtered.length > 0) {
        setSelectedQTypes(filtered);
        applied.push("questionTypes");
      }
    }
    if (f.difficulty && (DIFFICULTIES as readonly string[]).includes(f.difficulty)) {
      setDifficulty(f.difficulty);
      applied.push("difficulty");
    }
    flash(applied);
  };

  const canGenerate = topic.trim().length > 3 && subject.trim().length > 1 && selectedQTypes.length > 0;

  const generate = async () => {
    setOutput("");
    setUsage(null);
    setError("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    await streamAiResponse(
      "/api/v1/teacher/question-paper",
      {
        topic: topic.trim(),
        grade,
        subject: subject.trim(),
        board,
        total_marks: totalMarks,
        question_types: selectedQTypes,
        difficulty,
        language,
      },
      {
        onToken: (t) => setOutput((p) => p + t),
        onDone: (u) => { setUsage(u); setStreaming(false); },
        onError: (msg) => { setError(msg); setStreaming(false); },
        signal: ctrl.signal,
        errorMessages: {
          noBody: t("stream.noBody"),
          serviceError: t("stream.serviceError"),
          unknown: t("stream.unknown"),
        },
      },
    );
  };

  const stop = () => { abortRef.current?.abort(); };

  return (
    <FeatureGate feature="question_paper">
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("questionPaper.title")}</h1>
          <p className="text-sm text-ink-muted">{t("questionPaper.subtitle")}</p>
        </div>
      </div>

      <AiValueBanner />

      <SmartFillBox tool="question_paper" onExtracted={applyExtracted} />

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
            {t("generator.topic")} <span className="text-red-500">*</span>
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("questionPaper.topicPlaceholder")}
            maxLength={300}
            className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("topic")}`}
          />
          <p className="mt-1 text-xs text-ink-muted text-right">{topic.length}/300</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("generator.subjectRequired")}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("questionPaper.subjectPlaceholder")}
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("subject")}`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("generator.grade")}</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("grade")}`}
            >
              {GRADES.map((g) => <option key={g} value={g}>{t("generator.gradeOption", { grade: g })}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("generator.board")}</label>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("board")}`}
            >
              {BOARDS.map((b) => <option key={b} value={b}>{b === "State Board" ? t("options.board.State Board") : b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("questionPaper.totalMarks")}</label>
            <NumberInput
              min={10}
              max={100}
              value={totalMarks}
              emptyValue={40}
              onChange={(v) => setTotalMarks(v ?? 40)}
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("totalMarks")}`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("questionPaper.difficulty")}</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40/40${ring("difficulty")}`}
            >
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{t(`options.difficulty.${d}`)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
            {t("questionPaper.questionTypes")} <span className="text-red-500">*</span>
          </label>
          <div className={`flex flex-wrap gap-2 w-fit rounded-xl${ring("questionTypes")}`}>
            {Q_TYPES.map((qt) => (
              <button
                key={qt}
                onClick={() => toggleQType(qt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  selectedQTypes.includes(qt)
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-surface-secondary text-ink-muted hover:text-ink"
                }`}
              >
                {t(`options.questionType.${qt}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("generator.language")}</label>
          <div className={`flex gap-2 w-fit rounded-xl${ring("language")}`}>
            {(["en", "hi", "hinglish"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  language === l
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-surface-secondary text-ink-muted hover:text-ink"
                }`}
              >
                {t(`options.language.${l}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1">
          {streaming ? (
            <button onClick={stop} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
              <Square className="w-4 h-4" /> {t("generator.stop")}
            </button>
          ) : (
            <button onClick={generate} disabled={!canGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
              <Sparkles className="w-4 h-4" /> {t("questionPaper.generate")}
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
              <span className="text-sm font-semibold text-ink">{t("questionPaper.output")}</span>
              <div className="flex items-center gap-3">
                {streaming && <span className="flex items-center gap-1.5 text-xs text-indigo-500"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />{t("generator.generating")}</span>}
                {usage && <span className="flex items-center gap-1 text-xs text-ink-muted"><Zap className="w-3 h-3 text-amber-500" />{t("generator.credits", { charged: usage.credits_charged, remaining: usage.credits_remaining })}</span>}
                <DownloadPdfButton
                  contentRef={outputRef}
                  title="Question Paper"
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
