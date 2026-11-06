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

