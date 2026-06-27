import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Mounts the Auth0 routes (/auth/login, /auth/callback, /auth/logout, /auth/profile)
// and keeps the session fresh. Guarded so a missing/incomplete Auth0 config can
// NEVER black out the app — it simply forwards the request.
export async function middleware(request: NextRequest) {
  if (
    !process.env.AUTH0_DOMAIN ||
    !process.env.AUTH0_CLIENT_SECRET ||
    process.env.AUTH0_CLIENT_SECRET.startsWith("__PASTE")
  ) {
    return NextResponse.next();
  }
  try {
    const { auth0 } = await import("./lib/auth0");
    return await auth0.middleware(request);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  // Match everything except Next internals and our own API routes (which don't
  // need a session). This keeps /auth/* handled by Auth0 while /api/* stays open.
  matcher: ["/((?!_next/static|_next/image|api|favicon.ico|sitemap.xml|robots.txt).*)"],
};
