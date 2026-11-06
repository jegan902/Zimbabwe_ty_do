import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/utils/crypto";
import { prisma } from "@/lib/utils/db";
import { ConflictError, ValidationError } from "@/lib/utils/errors";
import { createdResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { registerSchema } from "@/lib/validation/auth";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 128);
}

export const POST = apiRoute(async (request) => {
  const ipAddress = clientIp(request);
  await consumeRateLimit("auth-register", ipAddress, 5, 60 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body phải là JSON hợp lệ");
  }

  const input = registerSchema.parse(body);
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw new ConflictError("Email đã được sử dụng");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      // Email is the canonical login identifier; the separate schema field is
      // retained for compatibility with the existing model.
      username: input.email,
      passwordHash,
      wallet: { create: {} },
      auditLogs: {
        create: { action: "USER_REGISTERED", entityType: "USER" },
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      fullName: true,
      avatar: true,
    },
  });

  await createSession(user.id, {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
  });

  return createdResponse(
    { user, wallet: { balance: "0.00", reservedBalance: "0.00", availableBalance: "0.00" } },
    "Tạo tài khoản thành công"
  );
});
