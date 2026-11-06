import { prisma } from "@/lib/utils/db";
import { getOrCreateWallet, creditWallet } from "@/lib/wallet/wallet.service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { realtimeBus } from "@/lib/realtime/bus";
import logger from "@/lib/utils/logger";
import { d } from "@/lib/utils/money";
import crypto from "crypto";

export interface DepositIntentResult {
  transactionId: string;
  paymentCode: string;
  amount: string;
  qrUrl: string;
  bankInfo: {
    bankBin: string;
    accountNumber: string;
    accountName: string;
  };
  expiresAt: Date;
}

function generatePaymentCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NAP";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createDepositIntent(
  userId: string,
  amount: number
): Promise<DepositIntentResult> {
  if (!Number.isFinite(amount) || amount < 10_000 || amount > 100_000_000) {
    throw new ValidationError("Số tiền nạp tối thiểu 10.000 VNĐ và tối đa 100.000.000 VNĐ");
  }

  const wallet = await getOrCreateWallet(userId);

  // Generate unique payment code
  let paymentCode = generatePaymentCode();
  let exists = await prisma.paymentTransaction.findUnique({ where: { paymentCode } });
  while (exists) {
    paymentCode = generatePaymentCode();
    exists = await prisma.paymentTransaction.findUnique({ where: { paymentCode } });
  }

  const bankBin = process.env.VIETQR_BANK_BIN || "970422";
  const accountNumber = process.env.VIETQR_BANK_ACCOUNT_NUMBER || "0000000000";
  const accountName = process.env.VIETQR_BANK_ACCOUNT_NAME || "MARKETPLACE ADMIN";

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const txn = await prisma.paymentTransaction.create({
    data: {
      userId,
      walletId: wallet.id,
      paymentCode,
      amount: d(amount).toFixed(2),
      status: "PENDING",
      paymentMethod: "VIETQR",
      gateway: "SEPAY",
      expiresAt,
    },
  });

  const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${paymentCode}&accountName=${encodeURIComponent(
    accountName
  )}`;

  return {
    transactionId: txn.id,
    paymentCode,
    amount: d(amount).toFixed(2),
    qrUrl,
    bankInfo: {
      bankBin,
      accountNumber,
      accountName,
    },
    expiresAt,
  };
}

export async function processPaymentWebhook(payload: Record<string, any>, signature?: string) {
  const webhookId = String(payload.id || payload.transactionId || crypto.randomUUID());
  const gatewayName = "SEPAY";

  // Check if webhook already processed
  const existingWebhook = await prisma.paymentWebhook.findUnique({
    where: {
      gatewayName_webhookId: {
        gatewayName,
        webhookId,
      },
    },
  });

  if (existingWebhook?.processed) {
    return { alreadyProcessed: true };
  }

  await prisma.paymentWebhook.upsert({
    where: {
      gatewayName_webhookId: {
        gatewayName,
        webhookId,
      },
    },
    create: {
      gatewayName,
      webhookId,
      payload: JSON.stringify(payload),
      signature: signature ?? null,
      status: "PENDING",
    },
    update: {
      payload: JSON.stringify(payload),
    },
  });

  // Extract memo/content and transfer amount
  const content = String(payload.content || payload.description || payload.code || "");
  const transferAmount = Number(payload.transferAmount || payload.amount || 0);

  // Search for NAPXXXXXX code in transfer content
  const codeMatch = content.match(/NAP[A-Z0-9]{6}/i);
  if (!codeMatch) {
    logger.warn({ content }, "Payment webhook received without matching NAP code");
    await prisma.paymentWebhook.update({
      where: { gatewayName_webhookId: { gatewayName, webhookId } },
      data: { status: "IGNORED", error: "Không tìm thấy mã nạp tiền NAP trong nội dung chuyển khoản" },
    });
    return { success: false, reason: "No payment code found" };
  }

  const paymentCode = codeMatch[0].toUpperCase();
  const paymentTxn = await prisma.paymentTransaction.findUnique({
    where: { paymentCode },
  });

  if (!paymentTxn) {
    logger.warn({ paymentCode }, "Payment transaction not found for code");
    await prisma.paymentWebhook.update({
      where: { gatewayName_webhookId: { gatewayName, webhookId } },
      data: { status: "IGNORED", error: `Không tìm thấy giao dịch nạp tiền cho mã ${paymentCode}` },
    });
    return { success: false, reason: "Transaction not found" };
  }

  if (paymentTxn.status === "VERIFIED") {
    await prisma.paymentWebhook.update({
      where: { gatewayName_webhookId: { gatewayName, webhookId } },
      data: { processed: true, status: "ALREADY_VERIFIED" },
    });
    return { success: true, message: "Transaction already verified" };
  }

  // Credit customer wallet with idempotency
  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.update({
      where: { id: paymentTxn.id },
      data: {
        status: "VERIFIED",
        receivedAmount: d(transferAmount).toFixed(2),
        paidAt: new Date(),
        verifiedAt: new Date(),
        gatewayTxnId: webhookId,
        gatewayResponse: JSON.stringify(payload),
      },
    });

    await tx.paymentWebhook.update({
      where: { gatewayName_webhookId: { gatewayName, webhookId } },
      data: {
        processed: true,
        processedAt: new Date(),
        status: "PROCESSED",
      },
    });
  });

  // Credit wallet through wallet service
  await creditWallet({
    userId: paymentTxn.userId,
    amount: d(transferAmount),
    transactionType: "DEPOSIT",
    referenceId: paymentTxn.id,
    idempotencyKey: `webhook-${gatewayName}-${webhookId}`,
    description: `Nạp tiền qua VietQR (${paymentCode})`,
  });

  realtimeBus.publish({
    type: "wallet.updated",
    userId: paymentTxn.userId,
    payload: { amount: transferAmount, paymentCode },
  });

  return { success: true, paymentCode, amount: transferAmount };
}

