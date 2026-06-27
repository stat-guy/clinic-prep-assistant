"use client";

import * as React from "react";
import type { PatientListItem } from "./types";
import { Input } from "./ui/Textarea";

type PatientPickerProps = {
  patients: PatientListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * PatientPicker — searchable, vertical list of selectable patient cards.
 * A name filter sits above the list (case-insensitive substring); the list
 * scrolls within a sensible max-height on desktop and flows naturally on
 * mobile. Each card shows name, age + sex, and a one-line focus from `reason`.
 */
export function PatientPicker({
  patients,
  selectedId,
  onSelect,
  disabled = false,
}: PatientPickerProps) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();

  const filtered = React.useMemo(
    () =>
      q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients,
    [patients, q],
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Search filter */}
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients by name…"
          aria-label="Search patients by name"
          disabled={disabled}
          className="pl-9"
        />
      </div>

      {/* List — scrolls within a max-height on desktop, flows free on mobile */}
      <div
        role="radiogroup"
        aria-label="Synthetic patients"
        className="-mr-1 flex flex-col gap-1.5 pr-1 lg:max-h-[420px] lg:overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] leading-relaxed text-[var(--muted)]">
            No patients match{" "}
            <span className="text-[var(--text)]">&ldquo;{query.trim()}&rdquo;</span>.
          </p>
        ) : (
          filtered.map((p) => {
            const selected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onSelect(p.id)}
                className={cx(
                  "group w-full min-h-[44px] rounded-xl border px-3 py-2.5 text-left",
                  "transition-[border,background,box-shadow] duration-150 focus-accent",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "border-[rgba(124,131,255,0.5)] bg-[rgba(124,131,255,0.06)] shadow-[0_0_0_1px_rgba(124,131,255,0.18),0_14px_40px_-26px_rgba(124,131,255,0.6)]"
                    : "border-[var(--border)] bg-[var(--panel)] hover:border-[#34343a] hover:bg-[var(--panel-raised)]",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cx(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      "font-mono text-[11px] tracking-tight",
                      selected
                        ? "bg-[rgba(124,131,255,0.16)] text-[#c7caff]"
                        : "bg-[var(--panel-raised)] text-[var(--muted)] group-hover:text-[var(--text)]",
                    )}
                  >
                    {initials(p.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[var(--text)]">
                        {p.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">
                        {p.age}
                        {p.sex ? ` · ${p.sex[0].toUpperCase()}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] leading-snug text-[var(--muted)]">
                      {p.reason}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Result count when filtering */}
      {q && filtered.length > 0 && (
        <p className="px-1 font-mono text-[10.5px] text-[var(--faint)]">
          {filtered.length} of {patients.length}
        </p>
      )}
    </div>
  );
}
