-- Two-factor authentication (TOTP, RFC 6238) for admin accounts.
-- Additive only: existing rows keep NULL and continue to log in with a password
-- until the owner enrols from /admin/security.

ALTER TABLE "User" ADD COLUMN "twoFactorSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" TEXT;
