import { prisma } from "@/lib/utils/db";
import { alertAccountLockout } from "@/lib/services/security-alert.service";

/** Attempts before the account is temporarily locked. */
export const MAX_FAILED_ATTEMPTS = 5;
/** How long the account stays locked once the limit is hit. */
export const LOCK_DURATION_MINUTES = 15;

/**
 * Counts a failed authentication step (wrong password or wrong 2FA code) and locks
 * the account on the transition. Shared by both steps so a stolen password cannot
 * be turned into unlimited guesses at the six-digit code.
 */
export async function recordFailedAttempt(params: {
  userId: string;
  email: string;
  currentCount: number;
  ipAddress: string;
  userAgent?: string | null;
}): Promise<{ locked: boolean; failedCount: number }> {
  const failedCount = params.currentCount + 1;
  const locked = failedCount >= MAX_FAILED_ATTEMPTS;

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      failedLoginCount: failedCount,
      lockedUntil: locked
        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
        : undefined,
      status: locked ? "LOCKED" : undefined,
    },
  });

  // Only fires on the transition, and the dedupe key limits it to once an hour.
  if (locked) {
    void alertAccountLockout({
      userId: params.userId,
      email: params.email,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  return { locked, failedCount };
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}
