import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// MUST stay in sync with `SESSION_COOKIE` in lib/auth/cookies.ts: importing that module
// pulls in `next/headers`, which is not available from the proxy layer.
const SESSION_COOKIE = "session";

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * `script-src` still allows inline scripts because Next.js hydrates prerendered pages with
 * an inline bootstrap payload; moving to a per-request nonce would require every route to
 * be dynamically rendered. The policy still blocks external script origins, objects,
 * framing and non-https subresources, which is the part that matters for injected markup.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Supplier product images live on arbitrary third-party hosts.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Cheap pre-filter for the admin portal. The authoritative checks stay in the API
  // routes (`requireApiAdmin`) and in the admin layout; this only drops anonymous traffic
  // before a protected bundle is streamed to the browser.
  if (
    pathname.startsWith("/admin") &&
    !request.cookies.get(SESSION_COOKIE)?.value
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);

  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  // Skip framework internals (static chunks, image optimizer, HMR socket) and the icon;
  // every document and API response still receives the security headers.
  matcher: ["/((?!_next|favicon.ico).*)"],
};
