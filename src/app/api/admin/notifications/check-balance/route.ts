import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { checkSupplierBalancesAndAlert } from "@/lib/services/notification.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

/**
 * Manual "check now" button: runs the balance scan immediately, bypassing the
 * 5-minute throttle used by the sync worker, and reports what happened.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const admin = await requireApiAdmin(request);
  await consumeRateLimit("admin-balance-alerts", admin.id, 6, 60);

  const summary = await checkSupplierBalancesAndAlert();

  const message =
    summary.alerted > 0
      ? `Đã gửi ${summary.alerted} email cảnh báo số dư`
      : summary.skipped > 0
        ? "Phát hiện số dư thấp nhưng SMTP/người nhận chưa được cấu hình nên không gửi được email"
        : summary.failed > 0
          ? "Có cảnh báo gửi thất bại, vui lòng kiểm tra lại cấu hình SMTP"
          : "Không có nhà cung cấp nào cần cảnh báo";

  return successResponse(summary, message);
});
