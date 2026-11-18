import type { NextRequest } from "next/server";
import { sendAdminAlert } from "@/lib/services/notification.service";
import { getClientIp } from "@/lib/utils/request";
import { redis } from "@/lib/utils/redis";
import logger from "@/lib/utils/logger";

/** Window used to group denials coming from one address. */
const DENIAL_WINDOW_SECONDS = 10 * 60;
/** Denials within the window before the admin is notified. */
const DENIAL_ALERT_THRESHOLD = 25;

function bucketOf(windowSeconds: number): number {
  return Math.floor(Date.now() / (windowSeconds * 1000));
}

/**
 * Tells the operator when an account gets locked by the failed-login counter.
 * One mail per account per hour, enforced by the notification dedupe key.
 */
export async function alertAccountLockout(params: {
  userId: string;
  email: string;
  ipAddress: string;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const hour = bucketOf(60 * 60);

    await sendAdminAlert({
      type: "SECURITY_LOCKOUT",
      dedupeKey: `security-lockout-${params.userId}-${hour}`,
      subject: `[CẢNH BÁO] Khoá tài khoản ${params.email} do đăng nhập sai`,
      body: [
        `Tài khoản: ${params.email} (${params.userId})`,
        `IP: ${params.ipAddress}`,
        `Thiết bị: ${params.userAgent ?? "không rõ"}`,
        `Thời điểm: ${new Date().toISOString()}`,
        "",
        "Tài khoản bị khoá 15 phút sau 5 lần đăng nhập sai liên tiếp.",
        "Nếu đây không phải khách hàng của bạn, hãy kiểm tra log đăng nhập và cân nhắc chặn IP.",
      ].join("\n"),
    });
  } catch (error) {
    logger.error({ err: error, userId: params.userId }, "Failed to send lockout alert");
  }
}

/**
 * Notifies the operator when one address accumulates denied requests (401/403/429).
 *
 * Counting lives in Redis so the signal is shared across instances; a storage
 * outage only loses the alert, never the request handling.
 */
export async function recordSecurityDenial(
  request: NextRequest,
  status: number,
  code?: string
): Promise<void> {
  if (status !== 401 && status !== 403 && status !== 429) return;

  const ip = getClientIp(request);
  const bucket = bucketOf(DENIAL_WINDOW_SECONDS);
  const key = `sec:deny:${ip}:${bucket}`;

  let count: number;
  try {
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, DENIAL_WINDOW_SECONDS);
  } catch (error) {
    logger.error({ err: error }, "Security denial counter unavailable");
    return;
  }

  // Fire exactly once per (ip, window): a spike must not become a mail flood.
  if (count !== DENIAL_ALERT_THRESHOLD) return;

  try {
    await sendAdminAlert({
      type: "SECURITY_DENIAL_SPIKE",
      dedupeKey: `security-denials-${ip}-${bucket}`,
      subject: `[CẢNH BÁO] ${DENIAL_ALERT_THRESHOLD}+ yêu cầu bị từ chối từ ${ip}`,
      body: [
        `IP: ${ip}`,
        `Số yêu cầu bị từ chối trong ${DENIAL_WINDOW_SECONDS / 60} phút: ${count}`,
        `Lần gần nhất: ${request.method} ${request.nextUrl.pathname} → ${status}${code ? ` (${code})` : ""}`,
        "",
        "Dấu hiệu dò quét credential hoặc spam endpoint. Kiểm tra access log trước khi chặn IP.",
      ].join("\n"),
    });
  } catch (error) {
    logger.error({ err: error, ip }, "Failed to send denial spike alert");
  }
}
