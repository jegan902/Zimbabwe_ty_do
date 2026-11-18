import nodemailer from "nodemailer";
import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { adminAlertEmails, isProduction } from "@/lib/env";
import { acquireLock } from "@/lib/cache/cache";

export interface SendAlertParams {
  supplierId?: string;
  type:
    | "SUPPLIER_LOW_BALANCE"
    | "SUPPLIER_CONNECTION_LOST"
    | "ORDER_RECONCILIATION";
  subject: string;
  body: string;
  dedupeKey?: string;
}

export type AlertDeliveryStatus = "SENT" | "DUPLICATE" | "SKIPPED" | "FAILED";

export interface SendAlertResult {
  status: AlertDeliveryStatus;
  notificationId?: string;
  reason?: string;
}

export interface BalanceAlertSummary {
  /** Active suppliers scanned. */
  checked: number;
  /** Suppliers whose balance is trustworthy enough to alert on. */
  eligible: number;
  alerted: number;
  /** Suppressed because the supplier was already warned within the repeat window. */
  suppressed: number;
  /** Low balance detected but email delivery is not configured. */
  skipped: number;
  failed: number;
  /** Suppliers that climbed back above the threshold. */
  recovered: number;
  /** Repeat window applied to this scan, in minutes. */
  repeatMinutes: number;
}

/**
 * How often the same supplier may be reminded while its balance stays low.
 * Stored in NotificationSetting so the admin can change it without a deploy;
 * the environment variable is only the fallback default.
 */
export const LOW_BALANCE_REPEAT_SETTING_KEY = "balance_alert_repeat_minutes";
export const DEFAULT_LOW_BALANCE_REPEAT_MINUTES = 24 * 60;
export const MIN_LOW_BALANCE_REPEAT_MINUTES = 5;
export const MAX_LOW_BALANCE_REPEAT_MINUTES = 60 * 24 * 14;

/** The scan itself runs at most once every 5 minutes, however often the sync ticks. */
const BALANCE_SCAN_INTERVAL_SECONDS = 300;
/** Two workers scanning inside the same window must not both send the email. */
const ALERT_DEDUPE_BUCKET_MINUTES = 10;

function clampRepeatMinutes(value: number): number {
  return Math.min(
    MAX_LOW_BALANCE_REPEAT_MINUTES,
    Math.max(MIN_LOW_BALANCE_REPEAT_MINUTES, Math.round(value)),
  );
}

/** DB setting → env fallback → 24h default. */
export async function getLowBalanceRepeatMinutes(): Promise<number> {
  const row = await prisma.notificationSetting.findUnique({
    where: { settingKey: LOW_BALANCE_REPEAT_SETTING_KEY },
    select: { settingValue: true },
  });

  const fromDb = Number(row?.settingValue);
  if (Number.isFinite(fromDb) && fromDb > 0) return clampRepeatMinutes(fromDb);

  const fromEnv = Number(process.env.BALANCE_ALERT_REPEAT_MINUTES);
  if (Number.isFinite(fromEnv) && fromEnv > 0)
    return clampRepeatMinutes(fromEnv);

  return DEFAULT_LOW_BALANCE_REPEAT_MINUTES;
}

export async function setLowBalanceRepeatMinutes(
  minutes: number,
): Promise<number> {
  const value = clampRepeatMinutes(minutes);
  await prisma.notificationSetting.upsert({
    where: { settingKey: LOW_BALANCE_REPEAT_SETTING_KEY },
    create: {
      settingKey: LOW_BALANCE_REPEAT_SETTING_KEY,
      settingValue: String(value),
    },
    update: { settingValue: String(value) },
  });
  return value;
}

/**
 * Alert recipients edited in the admin UI. Stored as a comma separated list so an
 * empty value can fall back to the ADMIN_ALERT_EMAIL environment variable.
 */
export const ALERT_RECIPIENTS_SETTING_KEY = "alert_recipients";
export const MAX_ALERT_RECIPIENTS = 5;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** Splits "a@x.com, b@y.com" (or an array) into lowercase tokens without validating. */
export function splitRecipientInput(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input.map((value) => String(value)).join(",")
    : typeof input === "string"
      ? input
      : "";
  return raw
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function dedupeValidEmails(input: unknown): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of splitRecipientInput(input)) {
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
    if (result.length >= MAX_ALERT_RECIPIENTS) break;
  }
  return result;
}

/** DB setting → ADMIN_ALERT_EMAIL env → empty (alert delivery is skipped). */
export async function getAlertRecipients(): Promise<string[]> {
  const row = await prisma.notificationSetting.findUnique({
    where: { settingKey: ALERT_RECIPIENTS_SETTING_KEY },
    select: { settingValue: true },
  });

  const fromDb = dedupeValidEmails(row?.settingValue ?? "");
  if (fromDb.length > 0) return fromDb;

  return dedupeValidEmails(adminAlertEmails());
}

/** An empty list clears the override and falls back to the environment again. */
export async function setAlertRecipients(input: unknown): Promise<string[]> {
  const recipients = dedupeValidEmails(input);

  if (recipients.length === 0) {
    await prisma.notificationSetting.deleteMany({
      where: { settingKey: ALERT_RECIPIENTS_SETTING_KEY },
    });
    return dedupeValidEmails(adminAlertEmails());
  }

  await prisma.notificationSetting.upsert({
    where: { settingKey: ALERT_RECIPIENTS_SETTING_KEY },
    create: {
      settingKey: ALERT_RECIPIENTS_SETTING_KEY,
      settingValue: recipients.join(","),
    },
    update: { settingValue: recipients.join(",") },
  });

  return recipients;
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/** SMTP is optional: the storefront keeps working, it just cannot deliver alert emails. */
export function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

export async function sendOtpEmail(
  email: string,
  otp: string,
): Promise<{ sent: boolean; devOtp?: string }> {
  const transporter = getMailTransporter();
  const subject = `[Digishop] Mã OTP đặt lại mật khẩu: ${otp}`;
  const text = `Xin chào,\n\nMã xác thực OTP của bạn để đặt lại mật khẩu là: ${otp}\nMã này có hiệu lực trong 15 phút. Vui lòng không cung cấp mã này cho người khác.\n\nTrân trọng,\nDigishop`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0; font-size: 22px; font-weight: 800;">Digishop</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Xác thực yêu cầu đặt lại mật khẩu</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Xin chào,<br>Bạn vừa yêu cầu lấy lại mật khẩu cho tài khoản <strong>${email}</strong>. Đây là mã OTP xác thực của bạn:
      </p>
      <div style="margin: 24px 0; padding: 18px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; text-align: center;">
        <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
        Mã OTP này có hiệu lực trong vòng <strong>15 phút</strong>. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ với bộ phận hỗ trợ.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        © ${new Date().getFullYear()} Digishop Marketplace. All rights reserved.
      </p>
    </div>
  `;

  if (!transporter) {
    if (isProduction()) {
      // Never print a live OTP in production logs: it is a password-equivalent secret.
      logger.error(
        { email },
        "SMTP is not configured - cannot deliver password reset OTP",
      );
      return { sent: false };
    }
    logger.info(
      { email, otp },
      "SMTP not configured — OTP logged for development",
    );
    console.log(
      `\n=========================================\n[OTP EMAIL] To: ${email}\n[OTP CODE]: ${otp}\n=========================================\n`,
    );
    return { sent: false, devOtp: otp };
  }

  try {
    await transporter.sendMail({
      from: `"Digishop Support" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    logger.error({ err, email }, "Failed to send OTP email via SMTP");
    if (isProduction()) {
      return { sent: false };
    }
    console.log(
      `\n=========================================\n[OTP EMAIL FALLBACK] To: ${email}\n[OTP CODE]: ${otp}\n=========================================\n`,
    );
    return { sent: false, devOtp: otp };
  }
}

export async function sendAdminAlert(
  params: SendAlertParams,
): Promise<SendAlertResult> {
  const recipients = await getAlertRecipients();

  // Deduplication check: the unique index on dedupeKey is the real guard, this
  // early read only avoids an exception in the common case.
  if (params.dedupeKey) {
    const existing = await prisma.emailNotification.findUnique({
      where: { dedupeKey: params.dedupeKey },
    });
    if (existing) {
      logger.info(
        { dedupeKey: params.dedupeKey },
        "Alert email suppressed by deduplication key",
      );
      return { status: "DUPLICATE", notificationId: existing.id };
    }
  }

  let notificationId: string;
  try {
    const notification = await prisma.emailNotification.create({
      data: {
        supplierId: params.supplierId ?? null,
        recipient: recipients.join(", ") || "admin@system.local",
        notificationType: params.type,
        subject: params.subject,
        body: params.body,
        dedupeKey: params.dedupeKey ?? null,
        status: "PENDING",
      },
    });
    notificationId = notification.id;
  } catch (err) {
    // Two workers racing on the same dedupeKey: the unique index decides who wins.
    if ((err as { code?: string }).code === "P2002") {
      return { status: "DUPLICATE" };
    }
    throw err;
  }

  const transporter = getMailTransporter();
  if (!transporter || recipients.length === 0) {
    const reason =
      recipients.length === 0 ? "NO_RECIPIENT" : "SMTP_NOT_CONFIGURED";
    logger.warn(
      { alertType: params.type, reason },
      "Alert email skipped: alert delivery is not configured",
    );
    await prisma.emailNotification.update({
      where: { id: notificationId },
      data: { status: "SKIPPED", errorMessage: reason },
    });
    return { status: "SKIPPED", notificationId, reason };
  }

  try {
    await transporter.sendMail({
      from: `"Hệ thống Cảnh báo" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: params.subject,
      text: params.body,
    });

    await prisma.emailNotification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
    });
    return { status: "SENT", notificationId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Gửi email thất bại";
    logger.error({ err }, "Failed to send alert email");
    await prisma.emailNotification.update({
      where: { id: notificationId },
      data: {
        status: "FAILED",
        errorMessage: errorMsg,
        attempts: { increment: 1 },
      },
    });
    return { status: "FAILED", notificationId, reason: errorMsg };
  }
}

/**
 * Scans active suppliers and emails the admin when a supplier balance is at or
 * below its alert threshold.
 *
 * Alert policy:
 *  - one email when the balance first drops to the threshold;
 *  - at most one reminder per repeat window (configurable, default 24h);
 *  - the lowBalanceNotifiedAt marker is cleared once the balance recovers, so a
 *    later drop alerts again.
 */
export async function checkSupplierBalancesAndAlert(): Promise<BalanceAlertSummary> {
  const [suppliers, repeatMinutes] = await Promise.all([
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      include: { balance: true },
    }),
    getLowBalanceRepeatMinutes(),
  ]);

  const summary: BalanceAlertSummary = {
    checked: suppliers.length,
    eligible: 0,
    alerted: 0,
    suppressed: 0,
    skipped: 0,
    failed: 0,
    recovered: 0,
    repeatMinutes,
  };

  for (const supplier of suppliers) {
    const balance = supplier.balance;
    if (!balance) continue;

    const currentBalance = Number(balance.balance.toString());
    const threshold = Number(balance.alertThreshold.toString());

    // Threshold 0 means "no alert configured for this supplier".
    if (threshold <= 0) continue;

    // A balance nobody ever confirmed (fresh supplier row, or an adapter without a
    // balance endpoint) sits at 0 and would alert the admin forever.
    const confirmed =
      Boolean(balance.lastVerifiedAt || balance.updatedBy) ||
      balance.balanceType === "ACTUAL";
    if (!confirmed) continue;

    summary.eligible += 1;

    if (currentBalance > threshold) {
      if (balance.lowBalanceNotifiedAt) {
        await prisma.supplierBalance.update({
          where: { id: balance.id },
          data: { lowBalanceNotifiedAt: null },
        });
        summary.recovered += 1;
      }
      continue;
    }

    if (balance.lowBalanceNotifiedAt) {
      const minutesSinceAlert =
        (Date.now() - balance.lowBalanceNotifiedAt.getTime()) / 60_000;
      if (minutesSinceAlert < repeatMinutes) {
        summary.suppressed += 1;
        continue;
      }
    }

    // Short bucket: two workers scanning at the same moment cannot both send, while
    // a failed delivery (SMTP fixed later) is retried within the next bucket.
    const dedupeBucket = Math.floor(
      Date.now() / (ALERT_DEDUPE_BUCKET_MINUTES * 60_000),
    );
    const dedupeKey = `low-bal-${supplier.id}-${dedupeBucket}`;

    const result = await sendAdminAlert({
      supplierId: supplier.id,
      type: "SUPPLIER_LOW_BALANCE",
      subject: `[CẢNH BÁO] Số dư nhà cung cấp ${supplier.name} xuống thấp`,
      body: `Kính gửi Admin,\n\nSố dư tại nhà cung cấp ${supplier.name} hiện tại là ${currentBalance.toLocaleString("vi-VN")} VNĐ, đã chạm hoặc xuống dưới ngưỡng cảnh báo (${threshold.toLocaleString("vi-VN")} VNĐ).\n\nVui lòng nạp thêm tiền vào tài khoản nhà cung cấp để tránh gián đoạn dịch vụ.\n\nTrân trọng,\nHệ thống`,
      dedupeKey,
    });

    switch (result.status) {
      case "SENT":
        summary.alerted += 1;
        await prisma.supplierBalance.update({
          where: { id: balance.id },
          data: { lowBalanceNotifiedAt: new Date() },
        });
        break;
      case "DUPLICATE":
        summary.suppressed += 1;
        break;
      case "SKIPPED":
        summary.skipped += 1;
        break;
      default:
        summary.failed += 1;
    }
  }

  if (summary.alerted || summary.skipped || summary.failed) {
    logger.info({ summary }, "Supplier balance alert scan finished");
  }

  return summary;
}

/**
 * Runs the balance scan at most once per interval across every worker.
 *
 * The lock is deliberately NOT released: its TTL is the throttle window, so the
 * 30s sync tick does not turn into a 30s alert scan (and into a 30s mail check).
 */
export async function runSupplierBalanceAlertsThrottled(
  intervalSeconds = BALANCE_SCAN_INTERVAL_SECONDS,
): Promise<{ ran: boolean; summary?: BalanceAlertSummary }> {
  try {
    const token = await acquireLock("supplier-balance-alerts", intervalSeconds);
    if (!token) return { ran: false };
    const summary = await checkSupplierBalancesAndAlert();
    return { ran: true, summary };
  } catch (err) {
    logger.error({ err }, "Supplier balance alert scan failed");
    return { ran: false };
  }
}
