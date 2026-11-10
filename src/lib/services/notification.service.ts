import nodemailer from "nodemailer";
import { prisma } from "@/lib/utils/db";
import logger from "@/lib/utils/logger";
import { adminAlertEmails } from "@/lib/env";

export interface SendAlertParams {
  supplierId?: string;
  type: "SUPPLIER_LOW_BALANCE" | "SUPPLIER_CONNECTION_LOST" | "ORDER_RECONCILIATION";
  subject: string;
  body: string;
  dedupeKey?: string;
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

export async function sendOtpEmail(email: string, otp: string): Promise<{ sent: boolean; devOtp?: string }> {
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
    logger.info({ email, otp }, "SMTP not configured — OTP logged for development");
    console.log(`\n=========================================\n[OTP EMAIL] To: ${email}\n[OTP CODE]: ${otp}\n=========================================\n`);
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
    logger.error({ err, email }, "Failed to send OTP email via SMTP, fallback to console");
    console.log(`\n=========================================\n[OTP EMAIL FALLBACK] To: ${email}\n[OTP CODE]: ${otp}\n=========================================\n`);
    return { sent: false, devOtp: otp };
  }
}

export async function sendAdminAlert(params: SendAlertParams): Promise<boolean> {
  const recipients = adminAlertEmails();
  if (recipients.length === 0) {
    logger.info({ alertType: params.type, subject: params.subject }, "Admin alert logged (no alert email set)");
  }

  // Deduplication check
  if (params.dedupeKey) {
    const existing = await prisma.emailNotification.findUnique({
      where: { dedupeKey: params.dedupeKey },
    });
    if (existing) {
      logger.info({ dedupeKey: params.dedupeKey }, "Alert email suppressed by deduplication key");
      return false;
    }
  }

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

  const transporter = getMailTransporter();
  if (!transporter || recipients.length === 0) {
    await prisma.emailNotification.update({
      where: { id: notification.id },
      data: { status: "SKIPPED", errorMessage: "SMTP not configured or recipient missing" },
    });
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"Hệ thống Cảnh báo" <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: params.subject,
      text: params.body,
    });

    await prisma.emailNotification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Gửi email thất bại";
    logger.error({ err }, "Failed to send alert email");
    await prisma.emailNotification.update({
      where: { id: notification.id },
      data: { status: "FAILED", errorMessage: errorMsg },
    });
    return false;
  }
}

export async function checkSupplierBalancesAndAlert() {
  const suppliersWithBalance = await prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    include: { balance: true },
  });

  for (const s of suppliersWithBalance) {
    if (!s.balance) continue;

    const currentBal = Number(s.balance.balance.toString());
    const threshold = Number(s.balance.alertThreshold.toString());

    if (currentBal <= threshold) {
      const todayHour = new Date().toISOString().slice(0, 13);
      const dedupeKey = `low-bal-${s.id}-${todayHour}`;

      await sendAdminAlert({
        supplierId: s.id,
        type: "SUPPLIER_LOW_BALANCE",
        subject: `[CẢNH BÁO] Số dư nhà cung cấp ${s.name} xuống thấp`,
        body: `Kính gửi Admin,\n\nSố dư tại nhà cung cấp ${s.name} hiện tại là ${currentBal.toLocaleString()} VNĐ, đã chạm hoặc xuống dưới ngưỡng cảnh báo (${threshold.toLocaleString()} VNĐ).\n\nVui lòng nạp thêm tiền vào tài khoản nhà cung cấp để tránh gián đoạn dịch vụ.\n\nTrân trọng,\nHệ thống`,
        dedupeKey,
      });

      await prisma.supplierBalance.update({
        where: { id: s.balance.id },
        data: { lowBalanceNotifiedAt: new Date() },
      });
    }
  }
}

