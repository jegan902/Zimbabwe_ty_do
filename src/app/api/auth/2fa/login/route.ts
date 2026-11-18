import { NextRequest } from "next/server";
import { recordFailedAttempt, resetFailedAttempts } from "@/lib/auth/attempts";
import { createSession } from "@/lib/auth/session";
import { verifyLoginChallenge } from "@/lib/auth/tokens";
import { verifySecondFactor } from "@/lib/auth/two-factor";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/utils/db";
import { AuthenticationError, ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";

/**
 * Second login step: exchanges the short-lived challenge (issued after a correct
 * password) plus a TOTP or recovery code for a real session.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const { ipAddress: ip, userAgent } = getRequestMeta(request);
  await consumeRateLimit("auth-2fa", ip, 10, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const payload = (body ?? {}) as { challenge?: unknown; code?: unknown };
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  if (!challenge || !code) {
    throw new ValidationError("Thiếu mã xác thực hoặc phiên chờ đã hết hạn");
  }

  // A tampered or expired challenge is an authentication failure, not a validation one.
  const verified = verifyLoginChallenge(challenge);
  if (!verified) {
    throw new AuthenticationError("Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.");
  }

  await consumeRateLimit("auth-2fa-account", verified.userId, 10, 15 * 60);

  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || user.status === "DELETED" || user.status === "SUSPENDED") {
    throw new AuthenticationError("Tài khoản không khả dụng");
  }
  if (user.status === "LOCKED" || (user.lockedUntil && user.lockedUntil > new Date())) {
    throw new AuthenticationError(
      "Tài khoản đang tạm khóa do nhiều lần xác thực sai. Vui lòng thử lại sau.",
    );
  }

  const method = await verifySecondFactor(user.id, code);
  if (!method) {
    // Wrong codes count toward the same lockout as wrong passwords.
    await recordFailedAttempt({
      userId: user.id,
      email: user.email,
      currentCount: user.failedLoginCount,
      ipAddress: ip,
      userAgent,
    });
    throw new AuthenticationError("Mã xác thực không đúng hoặc đã hết hạn");
  }

  await resetFailedAttempts(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id, { ipAddress: ip, userAgent });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "USER",
      entityId: user.id,
      metadata: JSON.stringify({ twoFactor: method }),
      ipAddress: ip,
      userAgent,
    },
  });

  return successResponse({
    user: {
      id: user.id,
      email: user.email,
      username: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    },
  });
});
