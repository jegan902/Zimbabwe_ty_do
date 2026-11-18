import { createSession } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/utils/crypto";
import { prisma } from "@/lib/utils/db";
import { ConflictError, ValidationError } from "@/lib/utils/errors";
import { createdResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";
import { registerSchema } from "@/lib/validation/auth";

export const POST = apiRoute(async (request) => {
  const { ipAddress } = getRequestMeta(request);
  if (process.env.NODE_ENV !== "development") {
    await consumeRateLimit("auth-register", ipAddress, 10, 60 * 60);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body phải là JSON hợp lệ");
  }

  const input = registerSchema.parse(body);

  if (process.env.NODE_ENV !== "development") {
    // Per-address window keeps signup spam bounded even when the caller rotates IPs.
    await consumeRateLimit("auth-register-account", input.email, 5, 60 * 60);
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw new ConflictError("Email đã được sử dụng");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      wallet: { create: {} },
      auditLogs: {
        create: { action: "USER_REGISTERED", entityType: "USER" },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      fullName: true,
    },
  });

  await createSession(user.id, {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
  });

  return createdResponse(
    {
      user,
      wallet: {
        balance: "0.00",
        reservedBalance: "0.00",
        availableBalance: "0.00",
      },
    },
    "Tạo tài khoản thành công",
  );
});
