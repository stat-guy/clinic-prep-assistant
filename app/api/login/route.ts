import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const okEmail = (process.env.APP_EMAIL || "").toLowerCase();
  const okPass = process.env.APP_PASSWORD || "";
  const secret = process.env.SESSION_SECRET || "";

  if (!secret || !okEmail || !okPass) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }
  if (String(email || "").toLowerCase() !== okEmail || String(password || "") !== okPass) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSession(okEmail, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
