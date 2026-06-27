import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth";

// Public paths reachable WITHOUT a session. Everything else — including the data
// APIs (/api/patients, /api/prep) — requires a valid signed session.
const PUBLIC = ["/login", "/api/login", "/api/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET || "";
  const allowed = (process.env.APP_EMAIL || "").toLowerCase();
  const email = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret);
  const ok = !!email && (!allowed || email.toLowerCase() === allowed);

  if (ok) return NextResponse.next();

  // No valid session: APIs get a clean 401; pages bounce to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
