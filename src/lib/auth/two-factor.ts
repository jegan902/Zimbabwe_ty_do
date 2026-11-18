import crypto from "node:crypto";
import { prisma } from "@/lib/utils/db";
import { decryptData, encryptData } from "@/lib/utils/crypto";
import logger from "@/lib/utils/logger";
import { AppError, ValidationError } from "@/lib/utils/errors";
import { getSessionSecret, safeEqual } from "./tokens";
import {
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotp,
} from "./totp";

const RECOVERY_CODE_COUNT = 8;
const TWO_FACTOR_DISABLED_CODES = ["0", "false", "no", "off"];

export function twoFactorIssuer(): string {
  return process.env.TWO_FACTOR_ISSUER?.trim() || "Digishop";
}

/**
 * Whether an admin must have a second factor to use the admin API.
 *
 * Defaults to ON in production and OFF in development, and either can be forced
 * with `ADMIN_2FA_REQUIRED`. Enrolling is never blocked by the gate — only the
 * admin endpoints are — so a fresh deployment cannot lock itself out.
 */
export function isAdminTwoFactorRequired(): boolean {
  const raw = process.env.ADMIN_2FA_REQUIRED?.trim().toLowerCase();
  if (!raw) return process.env.NODE_ENV === "production";
  return !TWO_FACTOR_DISABLED_CODES.includes(raw);
}

/** Recovery codes are stored hashed with the session secret, never in clear. */
function hashRecoveryCode(code: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(`2fa-recovery:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

function parseRecoveryHashes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function decryptSecret(stored: string): string {
  try {
    return decryptData(stored);
  } catch (error) {
    // Key rotated without `npm run db:reencrypt-secrets`: fail closed instead of
    // accepting any code, and leave an explicit trail for the operator.
    logger.error({ err: error }, "Cannot decrypt 2FA secret (ENCRYPTION_KEY changed?)");
    throw new AppError(
      500,
      "TWO_FACTOR_UNREADABLE",
      "Không đọc được cấu hình 2FA. Liên hệ kỹ thuật để cấp lại.",
    );
  }
}

const userTwoFactorSelect = {
  id: true,
  email: true,
  twoFactorSecretEnc: true,
  twoFactorEnabledAt: true,
  twoFactorRecoveryCodes: true,
} as const;

export interface TwoFactorState {
  enabled: boolean;
  /** A secret was generated but never confirmed. */
  pending: boolean;
  recoveryCodesRemaining: number;
  required: boolean;
}

export async function getTwoFactorState(userId: string): Promise<TwoFactorState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userTwoFactorSelect,
  });
  if (!user) throw new AppError(401, "AUTHENTICATION_ERROR", "Phiên đăng nhập không hợp lệ");

  return {
    enabled: Boolean(user.twoFactorEnabledAt),
    pending: Boolean(user.twoFactorSecretEnc) && !user.twoFactorEnabledAt,
    recoveryCodesRemaining: parseRecoveryHashes(user.twoFactorRecoveryCodes).length,
    required: isAdminTwoFactorRequired(),
  };
}

/**
 * Creates a new pending secret. The secret is returned once, in the otpauth URI the
 * authenticator app scans; it is stored encrypted so an app restart does not lose
 * an enrollment that was interrupted before the first code.
 */
export async function startTwoFactorEnrollment(user: {
  id: string;
  email: string;
}): Promise<{ secret: string; otpauthUrl: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorEnabledAt: true },
  });
  if (!existing) throw new AppError(401, "AUTHENTICATION_ERROR", "Phiên đăng nhập không hợp lệ");
  if (existing.twoFactorEnabledAt) {
    throw new AppError(409, "TWO_FACTOR_ALREADY_ENABLED", "Tài khoản đã bật 2FA");
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecretEnc: encryptData(secret),
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: null,
    },
  });

  return {
    secret,
    otpauthUrl: buildOtpAuthUrl({
      secret,
      accountName: user.email,
      issuer: twoFactorIssuer(),
    }),
  };
}

/** Confirms the pending secret with one valid code and issues recovery codes. */
export async function confirmTwoFactorEnrollment(
  userId: string,
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userTwoFactorSelect,
  });
  if (!user?.twoFactorSecretEnc) {
    throw new ValidationError("Chưa có thiết lập 2FA nào đang chờ xác nhận");
  }
  if (user.twoFactorEnabledAt) {
    throw new AppError(409, "TWO_FACTOR_ALREADY_ENABLED", "Tài khoản đã bật 2FA");
  }

  if (!verifyTotp(decryptSecret(user.twoFactorSecretEnc), code)) {
    throw new AppError(
      400,
      "TWO_FACTOR_CODE_INVALID",
      "Mã xác thực không đúng hoặc đã hết hạn. Thử lại với mã mới.",
    );
  }

  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabledAt: new Date(),
      twoFactorRecoveryCodes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
    },
  });

  return { recoveryCodes };
}

/**
 * Verifies a TOTP code or a recovery code.
 * Recovery codes are single use: the matching hash is removed inside a guarded
 * update so two concurrent requests cannot both spend the same code.
 */
export async function verifySecondFactor(
  userId: string,
  code: string,
): Promise<"totp" | "recovery" | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userTwoFactorSelect,
  });
  if (!user?.twoFactorSecretEnc || !user.twoFactorEnabledAt) return null;

  if (verifyTotp(decryptSecret(user.twoFactorSecretEnc), code)) return "totp";

  const hashes = parseRecoveryHashes(user.twoFactorRecoveryCodes);
  if (hashes.length === 0) return null;

  const candidate = hashRecoveryCode(code);
  const index = hashes.findIndex((hash) => safeEqual(hash, candidate));
  if (index === -1) return null;

  const remaining = hashes.filter((_, i) => i !== index);
  const { count } = await prisma.user.updateMany({
    where: { id: userId, twoFactorRecoveryCodes: user.twoFactorRecoveryCodes },
    data: { twoFactorRecoveryCodes: JSON.stringify(remaining) },
  });
  // Lost the race against another consumer of the same code: treat it as invalid.
  if (count === 0) return null;

  return "recovery";
}

/** Turns the second factor off. Requires a valid code so a stolen cookie is not enough. */
export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  const verified = await verifySecondFactor(userId, code);
  if (!verified) {
    throw new AppError(400, "TWO_FACTOR_CODE_INVALID", "Mã xác thực không đúng");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecretEnc: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: null,
    },
  });
}

/** Issues a fresh set of recovery codes; the old ones stop working immediately. */
export async function regenerateRecoveryCodes(
  userId: string,
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const verified = await verifySecondFactor(userId, code);
  if (!verified) {
    throw new AppError(400, "TWO_FACTOR_CODE_INVALID", "Mã xác thực không đúng");
  }

  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorRecoveryCodes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
    },
  });

  return { recoveryCodes };
}
