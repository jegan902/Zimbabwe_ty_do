import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/utils/db";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { sendOtpEmail } from "@/lib/services/notification.service";
import { ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 128);
}

export const POST = apiRoute(async (request: NextRequest) => {
  const ip = clientIp(request);
  await consumeRateLimit("auth-forgot-password", ip, 5, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const { email } = (body as { email?: string }) || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ValidationError("Vui lòng cung cấp địa chỉ email hợp lệ");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Always return success to prevent email enumeration, but only send if user exists
  if (!user || user.status === "DELETED") {
    return successResponse({
      message: "Nếu email tồn tại trong hệ thống, mã xác thực OTP đã được gửi đến hòm thư của bạn.",
    });
  }

  // Generate 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const tokenHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Expire any existing active reset tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Save new OTP token
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // Send email (or log if SMTP not set)
  const result = await sendOtpEmail(user.email, otp);

  return successResponse({
    message: "Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.",
    email: user.email,
    devOtp: result.devOtp, // Returned only when SMTP is not configured for easy testing
  });
});
