import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { recordFailedAttempt, resetFailedAttempts } from "@/lib/auth/attempts";
import { signLoginChallenge } from "@/lib/auth/tokens";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyPassword } from "@/lib/utils/crypto";
import { prisma } from "@/lib/utils/db";
import { AuthenticationError, ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";
import { loginSchema } from "@/lib/validation/auth";

export const POST = apiRoute(async (request: NextRequest) => {
  const { ipAddress: ip } = getRequestMeta(request);
  await consumeRateLimit("auth-login", ip, 10, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body phải là JSON hợp lệ");
  }

  const input = loginSchema.parse(body);

  // Per-account window: a spoofed X-Forwarded-For must not turn credential stuffing into
  // an unlimited number of tries against the same email.
  await consumeRateLimit("auth-login-account", input.email, 10, 15 * 60);

  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || user.status === "DELETED") {
    throw new AuthenticationError("Email hoặc mật khẩu không chính xác");
  }

  if (
    user.status === "LOCKED" ||
    (user.lockedUntil && user.lockedUntil > new Date())
  ) {
    throw new AuthenticationError(
      "Tài khoản của bạn tạm thời bị khóa do nhiều lần đăng nhập sai. Vui lòng thử lại sau.",
    );
  }

  const isValidPassword = await verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!isValidPassword) {
    await recordFailedAttempt({
      userId: user.id,
      email: user.email,
      currentCount: user.failedLoginCount,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    throw new AuthenticationError("Email hoặc mật khẩu không chính xác");
  }

  const userAgent = request.headers.get("user-agent");

  // Password step passed: the attempt counter is reset, but no session is issued
  // while a second factor is configured — see /api/auth/2fa/login.
  await resetFailedAttempts(user.id);

  if (user.twoFactorEnabledAt) {
    return successResponse({
      twoFactorRequired: true,
      challenge: signLoginChallenge(user.id),
    });
  }

  // Reset failed login count
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
      ipAddress: ip,
      userAgent: userAgent?.slice(0, 512) ?? null,
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
