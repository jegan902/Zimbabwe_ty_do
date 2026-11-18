import type { NextRequest } from "next/server";
import { optionalEnv } from "@/lib/env";
import { AppError } from "@/lib/utils/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Endpoints authenticated by API key or HMAC signature instead of the session
 * cookie: a cross-site request to them carries no ambient credentials, so the
 * origin check does not apply.
 */
const COOKIE_FREE_PREFIXES = ["/api/webhooks/", "/api/v1/partner/"];

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

function rejected(): AppError {
  return new AppError(
    403,
    "CSRF_ORIGIN_REJECTED",
    "Yêu cầu bị chặn: nguồn gửi không hợp lệ"
  );
}

/**
 * Rejects state-changing requests that a browser sends on behalf of another site.
 *
 * The session cookie is `SameSite=Lax`, which already blocks cross-site POSTs, but
 * that is a browser-dependent default. Origin / Sec-Fetch-Site are set by the
 * browser and cannot be forged by page script, so they are checked here for every
 * cookie-authenticated mutation. Non-browser clients (curl, server-to-server,
 * webhooks) send no Origin header and are not affected.
 */
export function assertTrustedOrigin(request: NextRequest): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const { pathname } = request.nextUrl;
  if (COOKIE_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

  // An Authorization / X-API-Key request is not cookie-authenticated: CSRF needs
  // ambient credentials, and these headers cannot be set by a cross-site page.
  if (request.headers.get("authorization") || request.headers.get("x-api-key")) return;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw rejected();

  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowedHosts = new Set<string>();
  const ownHost = hostOf(request.nextUrl.origin);
  if (ownHost) allowedHosts.add(ownHost);

  // Behind a proxy TLS terminates outside, so the public host lives in these headers.
  for (const header of ["x-forwarded-host", "host"]) {
    const host = hostOf(request.headers.get(header));
    if (host) allowedHosts.add(host);
  }

  const configuredHost = hostOf(optionalEnv("NEXT_PUBLIC_APP_URL"));
  if (configuredHost) allowedHosts.add(configuredHost);

  const originHost = hostOf(origin);
  if (!originHost || !allowedHosts.has(originHost)) throw rejected();
}
