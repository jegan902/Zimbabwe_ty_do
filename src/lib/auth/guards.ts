import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getCurrentUser, getUserFromRequest } from "@/lib/auth/session";
import { readCsrfCookie } from "@/lib/auth/cookies";
import { safeEqual } from "@/lib/auth/tokens";
import { AuthenticationError, AuthorizationError } from "@/lib/utils/errors";
import { isAdmin, type AuthUser } from "@/lib/types/auth";

/** Server component / server action guard. Redirects anonymous visitors to login. */
export async function requireUser(next?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = next ? `/dang-nhap?next=${encodeURIComponent(next)}` : "/dang-nhap";
    redirect(target);
  }
  return user;
}

export async function requireAdmin(next?: string): Promise<AuthUser> {
  const user = await requireUser(next);
  if (!isAdmin(user)) {
    throw new AuthorizationError("Bạn không có quyền truy cập khu vực quản trị");
  }
  return user;
}

/** Route handler guard. Throws typed errors that `apiRoute` converts to JSON. */
export async function requireApiUser(request: NextRequest): Promise<AuthUser> {
  const user = await getUserFromRequest(request);
  if (!user) throw new AuthenticationError("Vui lòng đăng nhập để tiếp tục");
  return user;
}

export async function requireApiAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await requireApiUser(request);
  if (!isAdmin(user)) {
    throw new AuthorizationError("Bạn không có quyền thực hiện thao tác này");
  }
  return user;
}

/**
 * Double-submit CSRF check for state-changing requests.
 *
 * The attacker cannot read the cookie value (cross-origin), so a forged request
 * cannot reproduce it in the header. Requests carrying an Authorization header
 * are exempt because they are not cookie-authenticated.
 */
export async function assertCsrf(request: NextRequest): Promise<void> {
  if (request.headers.get("authorization")) return;

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const cookieToken = await readCsrfCookie();
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new AuthorizationError("Phiên làm việc không hợp lệ, vui lòng tải lại trang");
  }
}