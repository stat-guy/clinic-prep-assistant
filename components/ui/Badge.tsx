import * as React from "react";

export type BadgeTone =
  | "high"
  | "med"
  | "low"
  | "safety"
  | "contradiction"
  | "missing-info"
  | "stale"
  | "neutral";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** show a small leading dot in the tone color */
  dot?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Priority + flag-category palettes. Safety↔high, contradiction↔med,
// missing-info↔low, stale↔grey.
const tones: Record<BadgeTone, string> = {
  high: "text-[#fca5a5] bg-[rgba(248,113,113,0.10)] border-[rgba(248,113,113,0.25)]",
  safety: "text-[#fca5a5] bg-[rgba(248,113,113,0.10)] border-[rgba(248,113,113,0.25)]",
  med: "text-[#fcd34d] bg-[rgba(251,191,36,0.10)] border-[rgba(251,191,36,0.25)]",
  contradiction:
    "text-[#fcd34d] bg-[rgba(251,191,36,0.10)] border-[rgba(251,191,36,0.25)]",
  low: "text-[#93c5fd] bg-[rgba(96,165,250,0.10)] border-[rgba(96,165,250,0.25)]",
  "missing-info":
    "text-[#93c5fd] bg-[rgba(96,165,250,0.10)] border-[rgba(96,165,250,0.25)]",
  stale: "text-[#a1a1aa] bg-[rgba(161,161,170,0.10)] border-[rgba(161,161,170,0.25)]",
  neutral: "text-[var(--muted)] bg-[var(--panel-raised)] border-[var(--border)]",
};

const dotColors: Record<BadgeTone, string> = {
  high: "bg-[#fca5a5]",
  safety: "bg-[#fca5a5]",
  med: "bg-[#fcd34d]",
  contradiction: "bg-[#fcd34d]",
  low: "bg-[#93c5fd]",
  "missing-info": "bg-[#93c5fd]",
  stale: "bg-[#a1a1aa]",
  neutral: "bg-[var(--muted)]",
};

/**
 * Badge — small monospace pill used for priorities & flag categories.
 * The `badge` class lets print flatten it to ink.
 */
export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx(
        "badge inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] leading-none",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cx("h-1.5 w-1.5 rounded-full", dotColors[tone])}
        />
      )}
      {children}
    </span>
  );
}
