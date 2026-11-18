import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/utils/db";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/utils/crypto";
import { ValidationError, AuthenticationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";

export const POST = apiRoute(async (request: NextRequest) => {
  const { ipAddress: ip } = getRequestMeta(request);
  await consumeRateLimit("auth-reset-password", ip, 5, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const { email, otp, token, newPassword } =
    (body as {
      email?: string;
      otp?: string;
      token?: string;
      newPassword?: string;
    }) || {};

  const effectiveOtp = otp || token;

  if (!email || !effectiveOtp || !newPassword) {
    throw new ValidationError(
      "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới",
    );
  }

  if (newPassword.length < 6) {
    throw new ValidationError("Mật khẩu mới phải có tối thiểu 6 ký tự");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Per-account attempt window: distributing guesses over many IPs must not turn the
  // 6-digit OTP into an oracle. 5 tries per 15 minutes is far below the 10^6 space.
  await consumeRateLimit(
    "auth-reset-password-account",
    normalizedEmail,
    5,
    15 * 60,
  );

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.status === "DELETED") {
    throw new AuthenticationError(
      "Thông tin xác thực không hợp lệ hoặc tài khoản không tồn tại",
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(effectiveOtp.trim())
    .digest("hex");

  const validToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!validToken) {
    throw new AuthenticationError(
      "Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại",
    );
  }

  // Hash new password using Argon2id
  const newPasswordHash = await hashPassword(newPassword);

  // Update password and unlock account if it was locked
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        status: user.status === "LOCKED" ? "ACTIVE" : undefined,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: validToken.id },
      data: { usedAt: new Date() },
    }),
    // Revoke old sessions for security
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return successResponse({
    message:
      "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.",
  });
});
