import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { confirmTwoFactorEnrollment } from "@/lib/auth/two-factor";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/utils/db";
import { ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { getRequestMeta } from "@/lib/utils/request";

/**
 * Step 2 of enrolment: the first valid code proves the authenticator app really
 * holds the secret. Only then is 2FA enabled and the recovery codes issued.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  await consumeRateLimit("auth-2fa-enable", user.id, 10, 15 * 60);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  if (!code.trim()) throw new ValidationError("Vui lòng nhập mã 6 chữ số từ ứng dụng xác thực");

  const { recoveryCodes } = await confirmTwoFactorEnrollment(user.id, code);
  const { ipAddress, userAgent } = getRequestMeta(request);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_2FA_ENABLED",
      entityType: "USER",
      entityId: user.id,
      ipAddress,
      userAgent,
    },
  });

  return successResponse(
    { enabled: true, recoveryCodes },
    "Đã bật xác thực hai lớp. Hãy lưu mã dự phòng ở nơi an toàn.",
  );
});
