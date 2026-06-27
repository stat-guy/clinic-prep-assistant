import * as React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium select-none " +
  "transition-[transform,background,border,opacity,box-shadow] duration-150 " +
  "focus-accent disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px " +
  "whitespace-nowrap";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

const variants: Record<Variant, string> = {
  // single accent — gradient from #7c83ff to #5b62e0
  primary:
    "text-white border border-[rgba(124,131,255,0.45)] " +
    "bg-[linear-gradient(180deg,#7c83ff_0%,#5b62e0_100%)] " +
    "shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_30px_-12px_rgba(124,131,255,0.65)] " +
    "hover:brightness-[1.06]",
  secondary:
    "text-[var(--text)] border border-[var(--border)] bg-[var(--panel-raised)] " +
    "hover:border-[#34343a] hover:bg-[#1a1a1d]",
  ghost:
    "text-[var(--muted)] border border-transparent bg-transparent " +
    "hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.04)]",
};

/**
 * Button — shadcn-style hand-rolled. Forwards all native button props.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "secondary", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(base, sizes[size], variants[variant], className)}
        {...props}
      />
    );
  },
);
