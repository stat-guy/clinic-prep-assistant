// Self-contained signed-session auth (Edge + Node compatible via Web Crypto).
// A single authorized clinician, gated by APP_EMAIL + APP_PASSWORD; the session
// is an HMAC-SHA256 signed token stored in an httpOnly cookie.

export const SESSION_COOKIE = "cpa_session";
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob(s + "=".repeat(pad));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

const TTL_MS = 1000 * 60 * 60 * 12; // 12h

export async function createSession(email: string, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ e: email, exp: Date.now() + TTL_MS })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromB64url(sig) as BufferSource,
      enc.encode(payload) as BufferSource,
    );
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!data.exp || Date.now() > data.exp) return null;
    return typeof data.e === "string" ? data.e : null;
  } catch {
    return null;
  }
}
