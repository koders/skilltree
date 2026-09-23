// Passphrase gate for deployed use (docs/decisions.md D2). With APP_PASSWORD
// unset the app is local-only (src/lib/local-only.ts). With it set, any host
// may reach the app, but every request needs a session cookie signed with a
// key derived from the passphrase — so changing APP_PASSWORD logs out every
// device. Web Crypto only: runs in the proxy and in Server Actions.

export const SESSION_COOKIE = "st_session";
export const SESSION_DAYS = 30;
export const UNLOCK_PATH = "/unlock";

const encoder = new TextEncoder();

export function gatePassword(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.APP_PASSWORD?.trim();
  return value ? value : null;
}

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Compares without an early exit, so timing doesn't leak how much matched. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function sha256(text: string): Promise<string> {
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export async function checkPassword(secret: string, attempt: string): Promise<boolean> {
  // Compare fixed-length digests rather than the raw strings.
  const [expected, actual] = await Promise.all([sha256(secret), sha256(attempt)]);
  return safeEqual(expected, actual);
}

/** `<expiry ms>.<signature>` */
export async function createSessionToken(secret: string, now: number): Promise<string> {
  const expires = now + SESSION_DAYS * 86_400_000;
  return `${expires}.${await hmac(secret, `skilltree-session:${expires}`)}`;
}

export async function verifySessionToken(secret: string, token: string | undefined, now: number): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresText = token.slice(0, dot);
  if (!/^\d+$/.test(expiresText)) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= now) return false;
  const expected = await hmac(secret, `skilltree-session:${expires}`);
  return safeEqual(expected, token.slice(dot + 1));
}

/** Where to go after unlocking: same-origin paths only (no open redirects). */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value === UNLOCK_PATH || value.startsWith(`${UNLOCK_PATH}?`)) return "/";
  return value;
}
