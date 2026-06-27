import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Textarea — hairline-bordered, dark, comfortable. Forwards all native props.
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(
        "w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]",
        "px-3.5 py-3 text-sm leading-relaxed text-[var(--text)]",
        "placeholder:text-[var(--faint)] resize-y",
        "transition-colors focus-accent",
        className,
      )}
      {...props}
    />
  );
});

/**
 * Input — single-line companion to Textarea, same visual language.
 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]",
        "px-3.5 text-sm text-[var(--text)]",
        "placeholder:text-[var(--faint)] transition-colors focus-accent",
        className,
      )}
      {...props}
    />
  );
});
