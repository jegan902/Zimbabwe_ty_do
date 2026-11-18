import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { requireApiUser } from "@/lib/auth/guards";
import { startTwoFactorEnrollment } from "@/lib/auth/two-factor";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

/**
 * Step 1 of enrolment: mint a secret and return it as a QR code (the secret is
 * shown in clear exactly once, so the operator can also type it manually).
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  await consumeRateLimit("auth-2fa-setup", user.id, 5, 15 * 60);

  const { secret, otpauthUrl } = await startTwoFactorEnrollment({
    id: user.id,
    email: user.email,
  });

  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return successResponse({ secret, otpauthUrl, qrDataUrl });
});
