'use client';

import { MessagesSquare } from 'lucide-react';
import { useAssistant } from './AssistantProvider';

/** Top-bar entry point. Iris marks it as the AI platform, as everywhere else. */
export function AssistantLauncher() {
  const { available, open, toggle } = useAssistant();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls="assistant-panel"
      aria-keyshortcuts="Control+J Meta+J"
      title="Assistant (Ctrl+J)"
      className={[
        'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-semibold',
        'transition-colors duration-150 motion-reduce:transition-none',
        open
          ? 'border-accent-ai bg-accent-ai text-white'
          : 'border-accent-ai-edge bg-accent-ai-tint text-accent-ai hover:border-accent-ai',
      ].join(' ')}
    >
      <MessagesSquare className="size-4" aria-hidden />
      <span className="hidden sm:inline">Assistant</span>
      <span className="sr-only sm:hidden">Open the assistant</span>
    </button>
  );
}
