"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Square, Sparkles, Zap, Plus } from "lucide-react";
import { streamAiResponse } from "@/lib/ai-stream";
import { useRbac } from "@/lib/rbac";
import { FeatureGate } from "@/components/ai/FeatureGate";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function TeacherChatPage() {
  const rbac = useRbac();
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [board, setBoard] = useState("CBSE");
  const [language, setLanguage] = useState("en");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [totalCredits, setTotalCredits] = useState(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!rbac.isTeacher) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-ink">Not available for your role</h2>
        <p className="text-sm text-ink-muted mt-1">Teacher Chat is a teacher-only feature.</p>
      </div>
    );
  }

  const newSession = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setError("");
    setTotalCredits(0);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setError("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);

    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let newSessionId = sessionId;

    await streamAiResponse(
      "/api/v1/teacher/chat",
      {
        message: text,
        session_id: newSessionId,
        subject: subject || undefined,
        grade: grade || undefined,
        board,
        language,
      },
      {
        onToken: (t) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + t };
            }
            return updated;
          });
        },
        onDone: (usage) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, streaming: false };
            }
            return updated;
          });
          if (usage) setTotalCredits((c) => c + usage.credits_charged);
          setStreaming(false);
          // First message creates a session — we don't get the session_id back from SSE
          // so we just keep the current one (subsequent sends will use same session via backend)
        },
        onError: (msg) => {
          setMessages((prev) => prev.filter((m) => !m.streaming));
          setError(msg);
          setStreaming(false);
        },
        signal: ctrl.signal,
      },
    );

    void newSessionId;
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <FeatureGate feature="teacher_chat">
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-3xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink">Teacher Chat</h1>
            <p className="text-xs text-ink-muted">Ask curriculum, pedagogy, or subject questions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalCredits > 0 && (
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Zap className="w-3 h-3 text-amber-500" />
              {totalCredits} credits
            </span>
          )}
          <button onClick={newSession} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-surface-secondary text-ink-muted hover:text-ink transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>
      </div>

      {/* Context row */}
      <div className="flex gap-2 mb-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        <input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="Grade (optional)"
          className="w-28 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        <select
          value={board}
          onChange={(e) => setBoard(e.target.value)}
          className="w-28 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-2 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          {["CBSE","ICSE","State Board","IB"].map((b) => <option key={b}>{b}</option>)}
        </select>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-24 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-secondary px-2 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-4 space-y-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8">
            <Sparkles className="w-8 h-8 text-slate-300" />
            <p className="text-sm font-medium text-ink-muted">Ask me anything about teaching</p>
            <p className="text-xs text-ink-muted">Lesson ideas, pedagogy, subject doubts, curriculum guidance...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-slate-100 dark:bg-surface-secondary text-ink rounded-bl-sm"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.streaming && <span className="inline-block w-1 h-4 bg-indigo-500 animate-pulse ml-0.5 rounded-sm align-middle" />}
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mt-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type your question… (Enter to send, Shift+Enter for new line)"
          rows={2}
          className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        {streaming ? (
          <button onClick={() => abortRef.current?.abort()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors self-end">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={send} disabled={!input.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors self-end">
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
    </FeatureGate>
  );
}
