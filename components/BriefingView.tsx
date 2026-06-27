"use client";

import * as React from "react";
import type { Briefing, FlagCategory, Priority } from "./types";
import { Card, CardLabel } from "./ui/Card";
import { Badge, type BadgeTone } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { Sparkline } from "./Sparkline";

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

function patientLine(p: { name: string; age?: number; sex?: string }) {
  const bits = [
    p.age != null ? `${p.age}` : null,
    p.sex ? p.sex : null,
  ].filter(Boolean);
  return bits.length ? `${p.name} · ${bits.join(" ")}` : p.name;
}

/** Labeled group of bullets used inside the Summary card. */
function BulletGroup({
  label,
  items,
  empty = "None recorded in notes",
}: {
  label: string;
  items: string[];
  empty?: string;
}) {
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] italic text-[var(--faint)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-[13.5px] leading-snug text-[var(--text)]"
            >
              <span
                aria-hidden
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--faint)]"
              />
              <span className="text-[var(--muted)]">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Small section heading with a monospace counter. */
function SectionHeading({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
        {children}
      </h2>
      {count != null && (
        <span className="font-mono text-[11px] text-[var(--faint)]">
          {count}
        </span>
      )}
      <div className="ml-1 h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

export function BriefingView({ briefing, patient }: BriefingViewProps) {
  const { summary, followUpQuestions, flags, trends } = briefing;
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

  return (
    <div className="print-area animate-rise">
      {/* Header — patient one-liner */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent)]">
            Pre-visit briefing
          </span>
          <span className="font-mono text-[11px] text-[var(--faint)]">
            {patientLine(patient)}
          </span>
        </div>
        <p className="mt-3 text-[19px] font-medium leading-snug tracking-[-0.01em] text-[var(--text)] sm:text-[21px]">
          {summary.oneLiner}
        </p>
      </header>

      {/* Trends — Tufte small multiples. Additive: renders nothing when absent. */}
      {trends && trends.length > 0 && (
        <>
          <SectionHeading count={trends.length}>Trends</SectionHeading>
          <Card elevated className="mb-6 p-4 sm:p-5">
            {/* Fixed-width sparks scroll on tiny screens rather than distort. */}
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="grid min-w-[18rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2.5 sm:gap-x-8">
                {trends.map((tr, i) => (
                  <React.Fragment key={i}>
                    {/* Measure label — left column, the vertical scan anchor. */}
                    <div className="min-w-0 truncate text-[13px] font-medium leading-none text-[var(--text)]">
                      {tr.label}
                    </div>
                    {/* Spark + value — identical spark width keeps columns aligned. */}
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

      {/* Summary */}
      <SectionHeading>Summary</SectionHeading>
      <Card elevated className="mb-6 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <BulletGroup label="Active problems" items={summary.activeProblems} />
          <BulletGroup label="Medications" items={summary.medications} />
          <BulletGroup
            label="Allergies"
            items={summary.allergies}
            empty="No known allergies in notes"
          />
          <BulletGroup
            label="Recent changes"
            items={summary.recentChanges}
            empty="No recent changes noted"
          />
        </div>
      </Card>

      {/* Follow-up questions */}
      <SectionHeading count={followUpQuestions.length}>
        Follow-up questions
      </SectionHeading>
      <div className="mb-6 space-y-2">
        {followUpQuestions.length === 0 && (
          <Card className="p-5 text-[13px] text-[var(--faint)]">
            No follow-up questions generated.
          </Card>
        )}
        {followUpQuestions.map((q, i) => (
          <Card key={i} className="p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-[11px] text-[var(--faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-medium leading-snug text-[var(--text)]">
                    {q.question}
                  </p>
                  <Badge tone={q.priority as BadgeTone} dot className="mt-0.5 shrink-0">
                    {priorityLabel[q.priority]}
                  </Badge>
                </div>
                <p className="mt-2 border-l border-[var(--border)] pl-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  {q.why}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Flags */}
      <SectionHeading count={flags.length}>Flags</SectionHeading>
      <div className="mb-6 space-y-2">
        {flags.length === 0 && (
          <Card className="p-5 text-[13px] text-[var(--faint)]">
            No flags raised.
          </Card>
        )}
        {flags.map((f, i) => (
          <Card key={i} className="p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={f.category as BadgeTone} dot>
                {flagLabel[f.category]}
              </Badge>
            </div>
            <p className="mt-2.5 text-[14px] leading-snug text-[var(--text)]">
              {f.message}
            </p>
            <div className="mt-2.5 flex gap-2.5">
              <span className="mt-px font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                Evidence
              </span>
              <p className="flex-1 text-[12.5px] leading-relaxed text-[var(--muted)]">
                {f.evidence}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Footer actions */}
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
/* Loading skeleton — mirrors the BriefingView layout while generating.       */
/* -------------------------------------------------------------------------- */

export function BriefingSkeleton() {
  return (
    <div aria-busy className="animate-rise">
      <header className="mb-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-5 w-full max-w-[34rem]" />
        <Skeleton className="mt-2 h-5 w-3/4 max-w-[26rem]" />
      </header>

      <Skeleton className="mb-2.5 h-4 w-28" />
      <Card elevated className="mb-6 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Skeleton className="mb-2.5 h-4 w-44" />
      <div className="mb-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3 w-2/3" />
          </Card>
        ))}
      </div>

      <Skeleton className="mb-2.5 h-4 w-20" />
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-3.5 sm:p-4">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="mt-3 h-4 w-5/6" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </Card>
        ))}
      </div>
    </div>
  );
}
