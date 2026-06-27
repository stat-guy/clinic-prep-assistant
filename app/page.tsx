"use client";

import * as React from "react";
import type { Briefing, PatientListItem, PrepResponse } from "@/components/types";
import { PatientPicker } from "@/components/PatientPicker";
import { BriefingView, BriefingSkeleton } from "@/components/BriefingView";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Textarea";

const DISCLAIMER =
  "Prep aid for a licensed clinician. Not diagnosis or treatment advice. Verify against the chart.";

type Status = "idle" | "loading" | "done" | "error";

export default function Page() {
  // patient roster
  const [patients, setPatients] = React.useState<PatientListItem[]>([]);
  const [patientsError, setPatientsError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // raw-notes panel
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [patientName, setPatientName] = React.useState("");

  // generation
  const [status, setStatus] = React.useState<Status>("idle");
  const [result, setResult] = React.useState<PrepResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Load synthetic patients on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/patients");
        if (!res.ok) throw new Error(`Failed to load patients (${res.status})`);
        const data = (await res.json()) as { patients: PatientListItem[] };
        if (cancelled) return;
        const list = data.patients ?? [];
        setPatients(list);
        setSelectedId((cur) => cur ?? list[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) {
          setPatientsError(
            e instanceof Error ? e.message : "Could not reach the server.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usingNotes = notesOpen && notes.trim().length > 0;
  const canGenerate =
    status !== "loading" && (usingNotes || selectedId != null);

  async function generate() {
    if (!canGenerate) return;
    setStatus("loading");
    setError(null);

    const body = usingNotes
      ? {
          notes: notes.trim(),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(patientName.trim() ? { patientName: patientName.trim() } : {}),
        }
      : { patientId: selectedId };

    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        /* non-JSON error body */
      }

      if (!res.ok) {
        const msg =
          (data as { error?: string } | null)?.error ??
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const payload = data as PrepResponse;
      if (!payload?.briefing) throw new Error("Malformed response from server.");
      setResult(payload);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <>
    <main className="mx-auto w-full max-w-6xl overflow-x-clip px-5 pb-[calc(6.5rem_+_env(safe-area-inset-bottom))] pt-12 sm:px-8 sm:pt-16 lg:pb-24">
      {/* ---------------------------------------------------------------- */}
      {/* Header with soft radial glow                                     */}
      {/* ---------------------------------------------------------------- */}
      <header className="relative mb-12 sm:mb-14">
        <div
          aria-hidden
          className="glow absolute left-1/2 top-[-120px] -z-10 h-[340px] w-[760px] max-w-[100vw] -translate-x-1/2"
        />
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_2px_rgba(124,131,255,0.7)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Clinic Prep Assistant
          </span>
        </div>
        <h1 className="mt-4 max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)] sm:text-[36px]">
          Walk in warm, not cold.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Scattered prior notes, pre-digested into a one-screen pre-visit
          briefing — faithful history, prioritized questions, and watch-flags.
        </p>
        <p className="mt-5 flex max-w-xl items-start gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--faint)] sm:inline-flex sm:items-center sm:rounded-full sm:py-1.5 sm:leading-none">
          <span
            aria-hidden
            className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[var(--faint)] sm:mt-0"
          />
          {DISCLAIMER}
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Two-column workspace                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Left — controls */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card elevated className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <CardLabel>Synthetic patient</CardLabel>
              <span className="font-mono text-[10.5px] text-[var(--faint)]">
                {patients.length > 0 ? `${patients.length}` : ""}
              </span>
            </div>

            {patientsError ? (
              <div className="rounded-xl border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3.5 py-3 text-[13px] text-[#fca5a5]">
                {patientsError}
              </div>
            ) : patients.length === 0 ? (
              <PatientPickerSkeleton />
            ) : (
              <PatientPicker
                patients={patients}
                selectedId={usingNotes ? null : selectedId}
                onSelect={setSelectedId}
                disabled={status === "loading"}
              />
            )}

            {/* Collapsible: paste raw notes */}
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className="focus-accent flex w-full items-center justify-between rounded-lg px-1 py-1 text-left"
                aria-expanded={notesOpen}
              >
                <span className="text-[13px] font-medium text-[var(--text)]">
                  Paste raw notes instead
                </span>
                <span
                  aria-hidden
                  className={`font-mono text-[var(--faint)] transition-transform duration-200 ${
                    notesOpen ? "rotate-90" : ""
                  }`}
                >
                  ›
                </span>
              </button>

              {notesOpen && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--faint)]">
                        Reason for visit
                      </label>
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="diabetes 3-mo f/u"
                        disabled={status === "loading"}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--faint)]">
                        Patient name
                      </label>
                      <Input
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="optional"
                        disabled={status === "loading"}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--faint)]">
                      Prior notes
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Paste concatenated prior notes here…"
                      rows={7}
                      disabled={status === "loading"}
                    />
                  </div>
                  {usingNotes && (
                    <p className="font-mono text-[10.5px] text-[var(--accent)]/80">
                      Using pasted notes — patient selection ignored.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Generate — in-panel on desktop; on mobile it lives in the
                always-reachable sticky bar at the bottom of the screen. */}
            <div className="mt-5 hidden lg:block">
              <Button
                variant="primary"
                size="md"
                className="min-h-[44px] w-full"
                disabled={!canGenerate}
                onClick={generate}
              >
                {status === "loading" ? "Generating…" : "Generate briefing"}
              </Button>
              <p className="mt-2.5 text-center font-mono text-[10.5px] text-[var(--faint)]">
                Surfaces what the notes already contain.
              </p>
            </div>
          </Card>
        </aside>

        {/* Right — output */}
        <section className="min-w-0">
          {status === "loading" ? (
            <Card elevated className="p-5 sm:p-7">
              <BriefingSkeleton />
            </Card>
          ) : status === "done" && result ? (
            <Card elevated className="p-5 sm:p-7">
              <BriefingView
                briefing={result.briefing as Briefing}
                patient={result.patient}
              />
            </Card>
          ) : status === "error" ? (
            <ErrorCard message={error} onRetry={generate} />
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </main>

    {/* ------------------------------------------------------------------ */}
    {/* Mobile sticky CTA — keeps "Generate briefing" thumb-reachable.     */}
    {/* Hidden on lg (the in-panel button takes over) and in print.        */}
    {/* ------------------------------------------------------------------ */}
    <div
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--panel)]/90 px-4 pt-3 backdrop-blur-md [padding-bottom:calc(0.75rem_+_env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="mx-auto w-full max-w-6xl">
        <Button
          variant="primary"
          size="md"
          className="min-h-[48px] w-full text-[15px]"
          disabled={!canGenerate}
          onClick={generate}
        >
          {status === "loading" ? "Generating…" : "Generate briefing"}
        </Button>
      </div>
    </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <Card className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-raised)]">
        <span aria-hidden className="font-mono text-lg text-[var(--accent)]/80">
          ⌘
        </span>
      </div>
      <p className="mt-5 text-[15px] font-medium text-[var(--text)]">
        Your briefing will appear here
      </p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">
        Pick a synthetic patient on the left (or paste raw notes), then press
        Generate briefing.
      </p>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <Card className="min-h-[280px] border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.04)] p-6">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#fca5a5]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#fca5a5]">
          Generation failed
        </span>
      </div>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[var(--text)]">
        {message ?? "Something went wrong while preparing the briefing."}
      </p>
      <div className="mt-5">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

function PatientPickerSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5"
        >
          <div className="h-8 w-8 shrink-0 rounded-lg bg-[var(--panel-raised)]" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-1/2 rounded bg-[var(--panel-raised)]" />
            <div className="h-3 w-5/6 rounded bg-[var(--panel-raised)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
