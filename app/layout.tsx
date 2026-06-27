import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Clinic Prep Assistant",
  description:
    "Upload a patient's prior notes before an appointment — Claude summarizes key history, flags follow-up questions, and generates a short doctor briefing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

async function getEmail(): Promise<string | null> {
  try {
    const secret = process.env.SESSION_SECRET || "";
    if (!secret) return null;
    const c = await cookies();
    return await verifySession(c.get(SESSION_COOKIE)?.value, secret);
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const email = await getEmail();

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
          {email ? (
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
                {email}
              </span>
              <a href="/api/logout" style={linkStyle}>
                Log out
              </a>
            </span>
          ) : null}
        </header>
        {children}
      </body>
    </html>
  );
}
