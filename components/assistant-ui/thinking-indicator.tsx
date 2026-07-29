"use client";

import { ProxMark } from "@/components/prox-logo";

/**
 * Modern "thinking" indicator shown while the assistant is working:
 * glowing Prox orb + staggered bouncing dots.
 */
export function ThinkingIndicator() {
  return (
    <span
      data-slot="aui_assistant-thinking"
      className="inline-flex items-center gap-2.5 py-1"
      aria-label="Vulcan Expert is thinking"
      role="status"
    >
      <span className="thinking-orb flex size-6 items-center justify-center rounded-full bg-orange-500/15">
        <ProxMark className="size-3.5 text-orange-500" />
      </span>
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="thinking-dot size-1.5 rounded-full bg-orange-500"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="text-muted-foreground animate-pulse text-xs font-medium tracking-wide">
        Thinking
      </span>
    </span>
  );
}
