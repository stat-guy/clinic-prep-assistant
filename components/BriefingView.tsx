"use client";

import * as React from "react";
import type { Briefing, FlagCategory, Priority } from "./types";
import { Card, CardLabel } from "./ui/Card";
import { Badge, type BadgeTone } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { Sparkline } from "./Sparkline";

/* ----------------------------------------------------------------------------
   BriefingView — built for ~60 seconds of triage before the doctor walks in.

   Reading order is the clinical priority order, top → bottom:
     1. ONE-LINER  · the situation + the one thing to do (prominent)
     2. WATCH      · must-not-miss flags, severity-sorted, top 3 by default
     3. ASK TODAY  · follow-up questions, priority-sorted, top 4 by default
     4. TRENDS     · Tufte small-multiple sparklines (only when present)
     5. SNAPSHOT   · problems/meds/allergies/changes — collapsed by default
     6. FOOTER     · copy + print

   Everything past the fold collapses behind toggles so the default view fits
   roughly one screen. Print re-expands all of it via the `print:` variants
   (collapsed content is rendered as `hidden print:flex|grid`, toggles/peeks
   carry `.no-print`), so the paper copy is always complete.
---------------------------------------------------------------------------- */

type BriefingViewProps = {
  briefing: Briefing;
  patient: { name: string; age?: number; sex?: string };
};

const priorityLabel: Record<Priority, string> = {
  high: "High",
  med: "Med",
  low: "Low",
};

const flagLabel: Record<FlagCategory, string> = {
  safety: "Safety",
  contradiction: "Contradiction",
  "missing-info": "Missing info",
  stale: "Stale",
};

/** Severity order for WATCH: safety → contradiction → missing-info → stale. */
const FLAG_ORDER: Record<FlagCategory, number> = {
  safety: 0,
  contradiction: 1,
  "missing-info": 2,
  stale: 3,
};

/** Priority order for ASK TODAY: high → med → low. */
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, med: 1, low: 2 };

/** Tone-colored left rule per flag category — matches the Badge palette. */
const flagBar: Record<FlagCategory, string> = {
  safety: "bg-[#fca5a5]",
  contradiction: "bg-[#fcd34d]",
  "missing-info": "bg-[#93c5fd]",
  stale: "bg-[#a1a1aa]",
};

const WATCH_DEFAULT = 3;
const ASK_DEFAULT = 4;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function patientLine(p: { name: string; age?: number; sex?: string }) {
  const bits = [p.age != null ? `${p.age}` : null, p.sex ? p.sex : null].filter(
    Boolean,
  );
  return bits.length ? `${p.name} · ${bits.join(" ")}` : p.name;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/* -------------------------------------------------------------------------- */
/* Small primitives                                                           */
/* -------------------------------------------------------------------------- */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={cx("shrink-0 transition-transform duration-150", open && "rotate-90")}
    >
      <path
        d="M3 1.5 L6.5 5 L3 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Section heading with a hairline rule, optional count + right-aligned action. */
function SectionHeading({
  children,
  count,
  action,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text)]">
        {children}
      </h2>
      {count != null && (
        <span className="font-mono text-[11px] text-[var(--faint)]">{count}</span>
      )}
      <div className="ml-1 h-px flex-1 bg-[var(--border)]" />
      {action}
    </div>
  );
}

/** "+N more" / "Show less" toggle — never prints. */
function MoreToggle({
  open,
  count,
  onClick,
  openLabel = "Show less",
}: {
  open: boolean;
  count: number;
  onClick: () => void;
  openLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)] focus-accent"
    >
      {open ? openLabel : `+${count} more`}
      <Chevron open={open} />
    </button>
  );
}

/** Compact pill used for problems/meds/allergies in the Snapshot. */
function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-[3px] text-[12px] leading-tight",
        tone === "warn"
          ? "border-[rgba(248,113,113,0.30)] bg-[rgba(248,113,113,0.08)] font-medium text-[#fca5a5]"
          : "border-[var(--border)] bg-[var(--panel-raised)] text-[var(--muted)]",
      )}
    >
      {children}
    </span>
  );
}

/** Labeled field inside the Snapshot grid. */
function SnapField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] italic text-[var(--faint)]">{children}</p>;
}

/* -------------------------------------------------------------------------- */
/* Main view                                                                  */
/* -------------------------------------------------------------------------- */

export function BriefingView({ briefing, patient }: BriefingViewProps) {
  const { summary, followUpQuestions, flags, trends } = briefing;

  // Severity-/priority-sorted once. [...] keeps the source arrays untouched.
  const sortedFlags = React.useMemo(
    () =>
      [...flags].sort((a, b) => FLAG_ORDER[a.category] - FLAG_ORDER[b.category]),
    [flags],
  );
  const sortedQuestions = React.useMemo(
    () =>
      [...followUpQuestions].sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      ),
    [followUpQuestions],
  );

  const [watchOpen, setWatchOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const [snapOpen, setSnapOpen] = React.useState(false);

  const [copied, setCopied] = React.useState(false);
  const resetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  async function copyBriefing() {
    try {
      await navigator.clipboard.writeText(briefing.briefingMarkdown);
      setCopied(true);
      if (resetRef.current) clearTimeout(resetRef.current);
      resetRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be unavailable; fail quietly
    }
  }

  const watchOverflow = Math.max(0, sortedFlags.length - WATCH_DEFAULT);
  const askOverflow = Math.max(0, sortedQuestions.length - ASK_DEFAULT);

  const allergyCount = summary.allergies.length;
  const changeCount = summary.recentChanges.length;

  // Collapsed flex rows must re-expand as `flex` (not `block`) when printing.
  const collapsedRow = "hidden print:flex";

  return (
    <div className="print-area animate-rise">
      {/* 1 · ONE-LINER ------------------------------------------------------- */}
      <Card elevated className="relative mb-5 overflow-hidden p-4 sm:p-5">
        <div
          aria-hidden
          className="glow no-print absolute -right-12 -top-20 h-44 w-44"
        />
        <div className="relative flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent)]">
            Pre-visit briefing
          </span>
          <span className="font-mono text-[11px] text-[var(--faint)]">
            {patientLine(patient)}
          </span>
        </div>
        <p className="relative mt-2.5 text-[19px] font-medium leading-snug tracking-[-0.01em] text-[var(--text)] sm:text-[22px]">
          {summary.oneLiner}
        </p>
      </Card>

      {/* 2 · WATCH ----------------------------------------------------------- */}
      <SectionHeading
        count={sortedFlags.length || undefined}
        action={
          watchOverflow > 0 ? (
            <MoreToggle
              open={watchOpen}
              count={watchOverflow}
              onClick={() => setWatchOpen((o) => !o)}
            />
          ) : undefined
        }
      >
        Watch
      </SectionHeading>
      <Card elevated className="mb-5 p-4 sm:p-5">
        {sortedFlags.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">
            No must-not-miss flags.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sortedFlags.map((f, i) => {
              const hidden = !watchOpen && i >= WATCH_DEFAULT;
              return (
                <li
                  key={i}
                  className={cx(
                    "flex gap-3 py-2.5 first:pt-0 last:pb-0",
                    hidden && collapsedRow,
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "mt-0.5 w-[3px] shrink-0 self-stretch rounded-full",
                      flagBar[f.category],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5">
                      <Badge tone={f.category as BadgeTone} dot className="mt-px shrink-0">
                        {flagLabel[f.category]}
                      </Badge>
                      <p className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-[var(--text)]">
                        {f.message}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[12px] leading-relaxed text-[var(--muted)] print:line-clamp-none">
                      {f.evidence}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 3 · ASK TODAY ------------------------------------------------------- */}
      <SectionHeading
        count={sortedQuestions.length || undefined}
        action={
          askOverflow > 0 ? (
            <MoreToggle
              open={askOpen}
              count={askOverflow}
              onClick={() => setAskOpen((o) => !o)}
            />
          ) : undefined
        }
      >
        Ask today
      </SectionHeading>
      <Card elevated className="mb-5 p-4 sm:p-5">
        {sortedQuestions.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">
            No follow-up questions generated.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--border)]">
            {sortedQuestions.map((q, i) => {
              const hidden = !askOpen && i >= ASK_DEFAULT;
              return (
                <li
                  key={i}
                  className={cx(
                    "flex gap-3 py-2.5 first:pt-0 last:pb-0",
                    hidden && collapsedRow,
                  )}
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[11px] text-[var(--faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2.5">
                      <p className="min-w-0 text-[13.5px] font-semibold leading-snug text-[var(--text)]">
                        {q.question}
                      </p>
                      <Badge
                        tone={q.priority as BadgeTone}
                        dot
                        className="mt-px shrink-0"
                      >
                        {priorityLabel[q.priority]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                      {q.why}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* 4 · TRENDS ---------------------------------------------------------- */}
      {trends && trends.length > 0 && (
        <>
          <SectionHeading count={trends.length}>Trends</SectionHeading>
          <Card elevated className="mb-5 p-3.5 sm:p-4">
            {/* Fixed-width sparks scroll on tiny screens rather than distort. */}
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="grid min-w-[20rem] grid-cols-[minmax(4.5rem,1fr)_auto] items-center gap-x-3 gap-y-2.5 sm:gap-x-5">
                {trends.map((tr, i) => (
                  <React.Fragment key={i}>
                    <div className="min-w-0 text-[12.5px] font-medium leading-tight text-[var(--text)] line-clamp-2">
                      {tr.label}
                    </div>
                    <Sparkline
                      points={tr.points}
                      unit={tr.unit}
                      concern={tr.concern}
                      label={tr.label}
                      className="justify-self-start"
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* 5 · SNAPSHOT (collapsed by default) --------------------------------- */}
      <SectionHeading
        action={
          <button
            type="button"
            aria-expanded={snapOpen}
            onClick={() => setSnapOpen((o) => !o)}
            className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)] focus-accent"
          >
            {snapOpen ? "Hide" : "Details"}
            <Chevron open={snapOpen} />
          </button>
        }
      >
        Snapshot
      </SectionHeading>
      <Card elevated className="mb-6 p-4 sm:p-5">
        {/* Collapsed peek — screen only. Allergies surfaced in red so a known
            allergy is never hidden, even before the section is opened. */}
        {!snapOpen && (
          <button
            type="button"
            onClick={() => setSnapOpen(true)}
            className="no-print flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left text-[12px] text-[var(--muted)] focus-accent"
          >
            {allergyCount > 0 ? (
              <span className="font-medium text-[#fca5a5]">
                {plural(allergyCount, "allergy", "allergies")}
              </span>
            ) : (
              <span className="text-[var(--faint)]">No known allergies</span>
            )}
            <span aria-hidden className="text-[var(--faint)]">
              ·
            </span>
            <span>{summary.medications.length} meds</span>
            <span aria-hidden className="text-[var(--faint)]">
              ·
            </span>
            <span>{summary.activeProblems.length} problems</span>
            <span aria-hidden className="text-[var(--faint)]">
              ·
            </span>
            <span>{plural(changeCount, "recent change", "recent changes")}</span>
          </button>
        )}

        {/* Full detail — on screen only when open; always rendered for print. */}
        <div className={snapOpen ? "block" : "hidden print:block"}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {/* Lead with the most decision-relevant fields. */}
            <SnapField label="Allergies">
              {allergyCount === 0 ? (
                <EmptyText>No known allergies in notes</EmptyText>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {summary.allergies.map((a, i) => (
                    <Chip key={i} tone="warn">
                      {a}
                    </Chip>
                  ))}
                </div>
              )}
            </SnapField>

            <SnapField label="Recent changes">
              {changeCount === 0 ? (
                <EmptyText>No recent changes noted</EmptyText>
              ) : (
                <ul className="space-y-1">
                  {summary.recentChanges.map((c, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] leading-snug text-[var(--muted)]"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--faint)]"
                      />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SnapField>

            <SnapField label="Active problems">
              {summary.activeProblems.length === 0 ? (
                <EmptyText>None recorded in notes</EmptyText>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {summary.activeProblems.map((p, i) => (
                    <Chip key={i}>{p}</Chip>
                  ))}
                </div>
              )}
            </SnapField>

            <SnapField label="Medications">
              {summary.medications.length === 0 ? (
                <EmptyText>None recorded in notes</EmptyText>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {summary.medications.map((m, i) => (
                    <Chip key={i}>{m}</Chip>
                  ))}
                </div>
              )}
            </SnapField>
          </div>
        </div>
      </Card>

      {/* 6 · FOOTER ---------------------------------------------------------- */}
      <div className="no-print flex flex-wrap items-center gap-2.5 border-t border-[var(--border)] pt-4">
        <Button
          variant="primary"
          onClick={copyBriefing}
          aria-live="polite"
          className="min-h-[44px] flex-1 sm:flex-none"
        >
          {copied ? "Copied" : "Copy briefing"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          className="min-h-[44px] flex-1 sm:flex-none"
        >
          Print
        </Button>
        <span className="w-full font-mono text-[10.5px] text-[var(--faint)] sm:ml-auto sm:w-auto">
          Markdown ready to paste into the note
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton — mirrors the new compact layout while generating.        */
/* -------------------------------------------------------------------------- */

export function BriefingSkeleton() {
  return (
    <div aria-busy className="animate-rise">
      {/* One-liner */}
      <Card elevated className="mb-5 p-4 sm:p-5">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="mt-3 h-5 w-full max-w-[34rem]" />
        <Skeleton className="mt-2 h-5 w-3/4 max-w-[26rem]" />
      </Card>

      {/* Watch */}
      <Skeleton className="mb-2.5 h-3 w-24" />
      <Card elevated className="mb-5 p-4 sm:p-5">
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <Skeleton className="h-full min-h-[2.5rem] w-[3px] rounded-full" />
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Ask today */}
      <Skeleton className="mb-2.5 h-3 w-28" />
      <Card elevated className="mb-5 p-4 sm:p-5">
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <Skeleton className="h-3 w-5" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Snapshot */}
      <Skeleton className="mb-2.5 h-3 w-24" />
      <Card elevated className="p-4 sm:p-5">
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </Card>
    </div>
  );
}
