import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { disableTwoFactor } from "@/lib/auth/two-factor";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/utils/db";
import { ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";

/**
 * Turns 2FA off. The current code is required: a stolen session cookie alone must
 * not be enough to remove the second factor.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  await consumeRateLimit("auth-2fa-disable", user.id, 5, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  if (!code.trim()) throw new ValidationError("Nhập mã xác thực hiện tại để tắt 2FA");

  await disableTwoFactor(user.id, code);
  const { ipAddress, userAgent } = getRequestMeta(request);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_2FA_DISABLED",
      entityType: "USER",
      entityId: user.id,
      ipAddress,
      userAgent,
    },
  });

  return successResponse({ enabled: false }, "Đã tắt xác thực hai lớp");
});
