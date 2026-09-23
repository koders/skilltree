import { NextResponse, type NextRequest } from "next/server";
import { gatePassword, SESSION_COOKIE, UNLOCK_PATH, verifySessionToken } from "@/lib/gate";
import { rejectNonLocal } from "@/lib/local-only";

/**
 * There's no user system (docs/decisions.md D2). Two modes:
 * - APP_PASSWORD unset: local only. Refuse anything not addressed to this
 *   machine, so a DNS-rebinding page can't read progress or call the Server
 *   Actions (Next's own action check passes when Host and Origin both name the
 *   attacker's domain).
 * - APP_PASSWORD set (e.g. on Vercel): any host, but every request needs the
 *   signed session cookie that /unlock sets. The cookie is SameSite=Lax, so
 *   cross-site POSTs arrive without it.
 */
export async function proxy(request: NextRequest) {
  const secret = gatePassword();
  if (!secret) {
    const reason = rejectNonLocal(request);
    if (reason) return text(reason, 403);
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (pathname === UNLOCK_PATH || pathname === "/icon.svg") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(secret, token, Date.now())) return NextResponse.next();

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    const url = request.nextUrl.clone();
    url.pathname = UNLOCK_PATH;
    url.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return text("Locked. Unlock skilltree first.", 401);
}

function text(body: string, status: number) {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const config = {
  // Pages, RSC requests, Server Actions (POSTs to page paths) and /api/*; Next's own assets and HMR are left alone.
  matcher: ["/((?!_next/).*)"],
};
