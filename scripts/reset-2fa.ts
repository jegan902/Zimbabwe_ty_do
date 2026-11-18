/**
 * Emergency exit for a lost 2FA device: clears the TOTP secret and recovery codes
 * of an account and unlocks it, then revokes every session so a stolen cookie
 * cannot be used to re-enroll silently.
 *
 * Run on the server with database access:
 *
 *   npm run admin:reset-2fa -- admin@example.com
 *
 * Only use it after verifying the operator's identity through another channel
 * (phone, in person). It cannot be triggered remotely — that is the point.
 */
import "dotenv/config";
import { prisma } from "../src/lib/utils/db";

async function main() {
  const email = process.argv.slice(2).find((arg) => !arg.startsWith("-"))?.trim().toLowerCase();

  if (!email) {
    console.error("Usage: npm run admin:reset-2fa -- <email>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, twoFactorEnabledAt: true },
  });

  if (!user) {
    console.error(`No account found for ${email}`);
    process.exitCode = 1;
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecretEnc: null,
        twoFactorEnabledAt: null,
        twoFactorRecoveryCodes: null,
        failedLoginCount: 0,
        lockedUntil: null,
        status: "ACTIVE",
      },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_2FA_RESET",
        entityType: "USER",
        entityId: user.id,
        metadata: JSON.stringify({ via: "cli", hadTwoFactor: Boolean(user.twoFactorEnabledAt) }),
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        email: user.email,
        role: user.role,
        twoFactorCleared: Boolean(user.twoFactorEnabledAt),
        sessionsRevoked: true,
        note: "Sign in with the password, then re-enable 2FA from /admin/security",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
