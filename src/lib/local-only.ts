// The app has no login (docs/decisions.md D2), so it must only answer this
// machine. `pnpm dev`/`pnpm start` bind to 127.0.0.1; src/proxy.ts uses these
// checks to also refuse requests addressed to any other host name, which is
// what a DNS-rebinding page in the browser sends (its own name in Host).

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True for a Host header value naming a loopback address (port optional). */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.trim().toLowerCase();
  const hostname = name.startsWith("[") ? name.slice(0, name.indexOf("]") + 1) : name.split(":")[0];
  return LOCAL_HOSTNAMES.has(hostname);
}

/** True for an http(s) Origin header on a loopback host; opaque ("null") origins are not local. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && isLocalHost(url.host);
  } catch {
    return false;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Why a request must be refused, or null when it may go through. */
export function rejectNonLocal(req: { method: string; headers: Headers }): string | null {
  const host = req.headers.get("host");
  if (!isLocalHost(host)) return `skilltree only answers on localhost (Host: ${host ?? "none"}).`;
  const origin = req.headers.get("origin");
  if (!SAFE_METHODS.has(req.method.toUpperCase()) && origin !== null && !isLocalOrigin(origin)) {
    return `skilltree only accepts writes from its own pages (Origin: ${origin}).`;
  }
  return null;
}
