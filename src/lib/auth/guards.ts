import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getCurrentUser, getUserFromRequest } from "@/lib/auth/session";
import { isAdminTwoFactorRequired } from "@/lib/auth/two-factor";
import { AppError, AuthenticationError, AuthorizationError } from "@/lib/utils/errors";
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
  // When 2FA is enforced, an unenrolled admin can still reach the setup screen but
  // cannot touch any admin endpoint — a stolen password alone must stay useless.
  if (isAdminTwoFactorRequired() && !user.twoFactorEnabled) {
    throw new AppError(
      403,
      "TWO_FACTOR_REQUIRED",
      "Tài khoản quản trị cần bật xác thực hai lớp trước khi tiếp tục",
    );
  }
  return user;
}