import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyPassword } from "@/lib/utils/crypto";
import { prisma } from "@/lib/utils/db";
import { AuthenticationError, ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { loginSchema } from "@/lib/validation/auth";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 128);
}

export const POST = apiRoute(async (request: NextRequest) => {
  const ip = clientIp(request);
  await consumeRateLimit("auth-login", ip, 10, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body phải là JSON hợp lệ");
  }

  const input = loginSchema.parse(body);

  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || user.status === "DELETED") {
    throw new AuthenticationError("Email hoặc mật khẩu không chính xác");
  }

  if (user.status === "LOCKED" || (user.lockedUntil && user.lockedUntil > new Date())) {
    throw new AuthenticationError("Tài khoản của bạn tạm thời bị khóa do nhiều lần đăng nhập sai. Vui lòng thử lại sau.");
  }

  const isValidPassword = await verifyPassword(input.password, user.passwordHash);

  if (!isValidPassword) {
    const nextFailedCount = user.failedLoginCount + 1;
    const lock = nextFailedCount >= 5;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailedCount,
        lockedUntil: lock ? new Date(Date.now() + 15 * 60 * 1000) : undefined,
        status: lock ? "LOCKED" : undefined,
      },
    });

    throw new AuthenticationError("Email hoặc mật khẩu không chính xác");
  }

  // Reset failed login count
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const userAgent = request.headers.get("user-agent");
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
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    },
  });
});

