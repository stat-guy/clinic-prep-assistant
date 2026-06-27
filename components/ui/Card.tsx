import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** subtle raised treatment (lighter panel + shadow + top sheen) */
  elevated?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Card — hairline-bordered rounded-2xl surface.
 * Hand-rolled (no UI lib). Forwards className, children and div props.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  function Card({ className, elevated = false, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cx(
          "rounded-2xl border border-[var(--border)]",
          elevated
            ? "bg-[var(--panel-raised)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-30px_rgba(0,0,0,0.7)] card-elev hairline-top"
            : "bg-[var(--panel)]",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Small uppercase monospace section label. */
export function CardLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]",
        className,
      )}
      {...props}
    />
  );
}
