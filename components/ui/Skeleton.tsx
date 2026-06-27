import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Skeleton — soft pulsing placeholder block.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cx(
        "animate-pulse rounded-md bg-[var(--panel-raised)]",
        className,
      )}
      {...props}
    />
  );
}
