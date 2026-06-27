import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Clinic Prep Assistant",
  description:
    "Upload a patient's prior notes before an appointment — Claude summarizes key history, flags follow-up questions, and generates a short doctor briefing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*) on iPhone notch / Dynamic Island
  themeColor: "#0a0a0a",
};

// Server-side session read, fully guarded: a missing/placeholder Auth0 config
// returns null (header shows "Log in") and never throws — the app stays usable.
async function getUser() {
  try {
    const secret = process.env.AUTH0_CLIENT_SECRET;
    if (!secret || secret.startsWith("__PASTE")) return null;
    const { auth0 } = await import("@/lib/auth0");
    const session = await auth0.getSession();
    return session?.user ?? null;
  } catch {
    return null;
  }
}

function GateScreen({ signedIn }: { signedIn: boolean }) {
  return (
    <main style={{ minHeight: "72vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div
        style={{
          maxWidth: 440,
          textAlign: "center",
          border: "1px solid var(--border,#262629)",
          background: "var(--panel,#111113)",
          borderRadius: 16,
          padding: "2.25rem",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
        <h1 style={{ fontSize: "1.15rem", margin: "0 0 0.5rem", color: "var(--text,#ededed)" }}>
          Authorized clinicians only
        </h1>
        <p style={{ color: "var(--muted,#8a8a93)", fontSize: "0.9rem", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
          {signedIn
            ? "This account isn’t authorized for this clinic. Please sign in with the clinician account."
            : "Patient prep is restricted. Please sign in to continue."}
        </p>
        <a
          href={signedIn ? "/auth/logout" : "/auth/login"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            padding: "0 1.4rem",
            borderRadius: 10,
            color: "#fff",
            background: "linear-gradient(135deg,#7c83ff,#5b62e0)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {signedIn ? "Switch account" : "Log in"}
        </a>
      </div>
    </main>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const authConfigured =
    !!process.env.AUTH0_CLIENT_SECRET && !process.env.AUTH0_CLIENT_SECRET.startsWith("__PASTE");
  const allow = (process.env.ALLOWED_EMAILS || "a.kar.wright@gmail.com")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim());
  // Open while Auth0 is unconfigured (build/demo safety); once configured, gate to the allowlist.
  const allowed = !authConfigured || (!!user?.email && allow.includes(user.email.toLowerCase()));

  const barStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    height: "44px",
    padding: "0 max(0.9rem, env(safe-area-inset-right)) 0 max(0.9rem, env(safe-area-inset-left))",
    borderBottom: "1px solid var(--border, #262629)",
    background: "rgba(10,10,10,0.72)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 60,
    fontSize: "0.8rem",
  };
  const linkStyle: React.CSSProperties = {
    color: "var(--text, #ededed)",
    textDecoration: "none",
    padding: "0.3rem 0.7rem",
    borderRadius: "8px",
    border: "1px solid var(--border, #262629)",
    minHeight: "32px",
    display: "inline-flex",
    alignItems: "center",
  };

  return (
    <html lang="en">
      <body>
        <header style={barStyle}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--muted, #8a8a93)",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--accent, #7c83ff)",
                boxShadow: "0 0 10px var(--accent, #7c83ff)",
              }}
            />
            Clinic Prep
          </span>
          {user ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                style={{
                  color: "var(--muted, #8a8a93)",
                  maxWidth: "46vw",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email ?? user.name ?? "Signed in"}
              </span>
              <a href="/auth/logout" style={linkStyle}>
                Log out
              </a>
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
              <a href="/auth/login" style={linkStyle}>
                Log in
              </a>
              <a
                href="/auth/login?screen_hint=signup"
                style={{
                  ...linkStyle,
                  color: "#fff",
                  border: "1px solid transparent",
                  background: "linear-gradient(135deg,#7c83ff,#5b62e0)",
                }}
              >
                Sign up
              </a>
            </span>
          )}
        </header>
        {allowed ? children : <GateScreen signedIn={!!user} />}
      </body>
    </html>
  );
}
