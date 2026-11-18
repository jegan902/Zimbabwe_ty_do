import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { regenerateRecoveryCodes } from "@/lib/auth/two-factor";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/utils/db";
import { ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";

/**
 * Issues a new set of recovery codes. The old ones stop working immediately, which
 * is what makes this the right answer after "a code might have leaked".
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  await consumeRateLimit("auth-2fa-recovery", user.id, 5, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  if (!code.trim()) throw new ValidationError("Nhập mã xác thực hiện tại để tạo mã dự phòng mới");

  const { recoveryCodes } = await regenerateRecoveryCodes(user.id, code);
  const { ipAddress, userAgent } = getRequestMeta(request);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_2FA_RECOVERY_CODES_ROTATED",
      entityType: "USER",
      entityId: user.id,
      ipAddress,
      userAgent,
    },
  });

  return successResponse({ recoveryCodes }, "Đã tạo bộ mã dự phòng mới. Mã cũ không còn hiệu lực.");
});
