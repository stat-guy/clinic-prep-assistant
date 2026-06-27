import * as React from "react";
import type { TrendConcern, TrendPoint } from "./types";

/* ----------------------------------------------------------------------------
   Sparkline — a Tufte "word-sized graphic" for a single clinical measure.

   Tufte rules applied STRICTLY:
   · Maximize data-ink: the polyline IS the graphic. No axes, gridlines, border,
     ticks, labels or background box — nothing but the line and two dots.
   · Layering: the trajectory line recedes (muted, ~70% opacity) so the
     emphasized last point and the bold value carry the signal.
   · Last-point emphasis: a filled dot on the final reading, in the concern
     color, with the latest value + unit beside it.
   · "Compared to what": a faint hollow dot anchors the first reading.
   · Words + numbers + image integrated: value, unit and a Δ direction arrow
     sit inline with the spark, reading as one glance-able unit.
---------------------------------------------------------------------------- */

/** Last-point / value color, keyed by clinical concern. Matches the app palette. */
const CONCERN_COLOR: Record<TrendConcern, string> = {
  high: "#fca5a5",
  med: "#fcd34d",
  low: "#93c5fd",
  none: "#8a8a93", // --muted
};

/** Trim float noise; keep at most 2 decimals without trailing zeros. */
function fmtValue(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

type SparklineProps = {
  points: TrendPoint[];
  unit?: string;
  concern?: TrendConcern;
  /** measure name, used only for the SVG accessible label */
  label?: string;
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({
  points,
  unit,
  concern = "none",
  label,
  width = 132,
  height = 30,
  className,
}: SparklineProps) {
  // Additive & defensive — never break the briefing on bad/empty data.
  if (!points || points.length === 0) return null;

  const color = CONCERN_COLOR[concern] ?? CONCERN_COLOR.none;

  const values = points.map((p) => p.v);
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // flat series → centers via the padding below

  // ~12% vertical padding so the shape fills the box without clipping the dots.
  const pad = range * 0.12;
  const domainMin = min - pad;
  const domainSpan = range + pad * 2;

  // Inset so the end dots never touch the edges (pure breathing room, not chrome).
  const padX = 4;
  const padY = 5;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xAt = (i: number) =>
    n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;
  const yAt = (v: number) => padY + innerH * (1 - (v - domainMin) / domainSpan);

  const coords = values.map((v, i) => [xAt(i), yAt(v)] as const);
  const polyPoints = coords
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const [fx, fy] = coords[0];
  const [lx, ly] = coords[n - 1];

  const firstV = values[0];
  const lastV = values[n - 1];

  // Δ direction, first → last.
  const dir = lastV > firstV ? "up" : lastV < firstV ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "→";

  // The arrow only "lights up" (concern color) when the measure is rising into
  // an elevated concern; otherwise it recedes to muted (layering).
  const concerningRise =
    dir === "up" && (concern === "high" || concern === "med");
  const arrowColor = concerningRise ? color : "var(--muted)";

  const ariaLabel =
    `${label ? `${label} ` : ""}trend ${fmtValue(firstV)} to ${fmtValue(lastV)}` +
    `${unit ? ` ${unit}` : ""}`;

  return (
    <div className={["flex items-center gap-2.5", className].filter(Boolean).join(" ")}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0 overflow-visible"
        role="img"
        aria-label={ariaLabel}
      >
        {/* The trajectory — muted & semi-transparent so it recedes (layering). */}
        {n > 1 && (
          <polyline
            points={polyPoints}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.7}
          />
        )}

        {/* "Compared to what" — a faint hollow anchor on the first reading. */}
        {n > 1 && (
          <circle
            cx={fx}
            cy={fy}
            r={2}
            fill="var(--bg)"
            stroke="var(--faint)"
            strokeWidth={1}
          />
        )}

        {/* Last-point emphasis — filled dot in the concern color. */}
        <circle cx={lx} cy={ly} r={2.6} fill={color} />
      </svg>

      {/* Words + numbers, integrated with the image. */}
      <div className="flex items-baseline gap-1 whitespace-nowrap tabular-nums">
        <span className="text-[13px] font-semibold leading-none" style={{ color }}>
          {fmtValue(lastV)}
          {unit && (
            <span className="ml-0.5 text-[11px] font-medium opacity-70">{unit}</span>
          )}
        </span>
        <span
          aria-hidden
          className="text-[10px] leading-none"
          style={{ color: arrowColor }}
        >
          {arrow}
        </span>
      </div>
    </div>
  );
}
