"use client";

import * as React from "react";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error || "Sign in failed");
    } catch {
      setError("Could not reach the server.");
    }
    setLoading(false);
  }

  return (
    <main className="grid min-h-[82vh] place-items-center px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-7"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_2px_rgba(124,131,255,0.7)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Clinic Prep Assistant
          </span>
        </div>
        <h1 className="text-[20px] font-semibold text-[var(--text)]">Sign in</h1>
        <p className="mb-5 mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
          Authorized clinicians only. Patient data is restricted.
        </p>

        <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--faint)]">
          Email
        </label>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.org"
          className="mb-4 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        <label className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--faint)]">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mb-5 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        {error ? (
          <p className="mb-4 rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3 py-2 text-[13px] text-[#fca5a5]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="min-h-[46px] w-full rounded-xl bg-[linear-gradient(135deg,#7c83ff,#5b62e0)] text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
