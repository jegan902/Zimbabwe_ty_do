import type { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/utils/db";
import { getClientIp } from "@/lib/utils/request";
import logger from "@/lib/utils/logger";

/** Query parameters that must never end up in an audit row. */
const SENSITIVE_QUERY_KEYS = new Set([
  "api_key",
  "apikey",
  "token",
  "password",
  "secret",
  "signature",
]);

/** CUIDs and numeric ids are the only segments treated as an entity id. */
const ID_SEGMENT = /^(c[a-z0-9]{20,}|\d+)$/;

function redactQuery(search: string): string | null {
  if (!search || search === "?") return null;
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) params.set(key, "[redacted]");
  }
  return params.toString();
}

function describePath(pathname: string): { resource: string; entityId: string | null } {
  const segments = pathname.replace(/^\/api\/admin\/?/, "").split("/").filter(Boolean);
  const resource = (segments[0] ?? "admin").toUpperCase();
  const candidate = segments[1];
  return { resource, entityId: candidate && ID_SEGMENT.test(candidate) ? candidate : null };
}

/**
 * Writes one `AuditLog` row for every successful admin mutation.
 *
 * Doing it in `apiRoute` instead of 19 individual handlers means a new admin route
 * is audited by construction, and the caller cannot forget the call.
 */
export async function recordAdminMutation(
  request: NextRequest,
  responseStatus: number
): Promise<void> {
  try {
    const { pathname, search } = request.nextUrl;
    if (!pathname.startsWith("/api/admin")) return;

    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
    if (responseStatus >= 400) return;

    const user = await getUserFromRequest(request);
    if (!user) return;

    const { resource, entityId } = describePath(pathname);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `ADMIN_${method}`,
        entityType: resource,
        entityId,
        metadata: JSON.stringify({
          path: pathname,
          query: redactQuery(search),
          status: responseStatus,
        }),
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      },
    });
  } catch (error) {
    // Auditing must never turn a successful admin action into a 500.
    logger.error({ err: error }, "Failed to write admin audit log");
  }
}
