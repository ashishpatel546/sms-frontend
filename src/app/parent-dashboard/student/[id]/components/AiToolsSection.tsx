"use client";

import { useState } from "react";
import { Sparkles, MessageCircle, Lightbulb, ListChecks, Map, CreditCard, type LucideIcon } from "lucide-react";
import { AiFeatureGate } from "@/components/ai/AiFeatureGate";
import { AiTutorChatTool } from "@/components/ai/tools/AiTutorChatTool";
import { ExplainTopicTool } from "@/components/ai/tools/ExplainTopicTool";
import { PracticeQuizTool } from "@/components/ai/tools/PracticeQuizTool";
import { LearningPathTool } from "@/components/ai/tools/LearningPathTool";
import { AiPlanTool } from "@/components/ai/tools/AiPlanTool";

type AiTool = "chat" | "explain" | "quiz" | "learning-path" | "plan";

const TOOLS: { key: AiTool; label: string; icon: LucideIcon }[] = [
  { key: "chat", label: "Ask AI", icon: MessageCircle },
  { key: "explain", label: "Explain", icon: Lightbulb },
  { key: "quiz", label: "Quiz", icon: ListChecks },
  { key: "learning-path", label: "Learning Path", icon: Map },
  { key: "plan", label: "My Plan", icon: CreditCard },
];

interface AiToolsSectionProps {
  studentId: string;
  info: any;
}

export function AiToolsSection({ info }: AiToolsSectionProps) {
  const [activeTool, setActiveTool] = useState<AiTool>("chat");
  const defaultGrade = info?.className?.match(/\d+/)?.[0] ?? "8";
  const onUpgradeClick = () => setActiveTool("plan");

  return (
    <AiFeatureGate>
      <div className="space-y-4">
        {/* Header card */}
        <div className="flex items-center gap-3 bg-linear-to-r from-violet-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">AI Tutor</h2>
            <p className="text-violet-100 text-sm">Personalized help, explanations, quizzes &amp; study plans</p>
          </div>
        </div>

        {/* Sub-tool switcher */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {TOOLS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTool(key)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-h-14 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                activeTool === key
                  ? "bg-brand text-white shadow-md shadow-brand/20 dark:bg-white dark:text-slate-900 dark:shadow-slate-900/20"
                  : "text-ink-muted hover:text-ink hover:bg-brand/5 bg-white border border-slate-200 hover:border-brand/30 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:hover:border-white/20"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] leading-tight text-center whitespace-nowrap overflow-hidden w-full">{label}</span>
            </button>
          ))}
        </div>

        {/* Active tool panel */}
        <div className="animate-scale-in">
          {activeTool === "chat" && (
            <AiTutorChatTool defaultGrade={defaultGrade} onUpgradeClick={onUpgradeClick} heightClass="h-[70vh] min-h-[420px]" />
          )}
          {activeTool === "explain" && (
            <ExplainTopicTool defaultGrade={defaultGrade} onUpgradeClick={onUpgradeClick} />
          )}
          {activeTool === "quiz" && (
            <PracticeQuizTool defaultGrade={defaultGrade} onUpgradeClick={onUpgradeClick} />
          )}
          {activeTool === "learning-path" && (
            <LearningPathTool defaultGrade={defaultGrade} onUpgradeClick={onUpgradeClick} />
          )}
          {activeTool === "plan" && <AiPlanTool />}
        </div>
      </div>
    </AiFeatureGate>
  );
}
