import crypto from "node:crypto";
import { prisma } from "@/lib/utils/db";
import { decryptData, encryptData } from "@/lib/utils/crypto";
import logger from "@/lib/utils/logger";

/**
 * Partner API keys at rest.
 *
 * The key is a 256-bit random hex string, so a plain SHA-256 is enough to make a
 * database dump useless (there is nothing to brute-force). The hash is the only
 * value used for lookup; a copy encrypted with ENCRYPTION_KEY is kept so the key
 * owner can still reveal it in the portal.
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Columns written for a new key. `apiKey` is cleared so no plaintext remains. */
export function apiKeyColumns(raw: string) {
  return {
    apiKeyHash: hashApiKey(raw),
    apiKeyEnc: encryptData(raw),
    apiKey: null,
  };
}

/**
 * Returns the key as its owner should see it. Encrypted storage wins; the legacy
 * plaintext column is only honoured until a migration rewrites the row.
 */
export function revealApiKey(record: {
  apiKeyEnc: string | null;
  apiKey: string | null;
}): string | null {
  if (record.apiKeyEnc) {
    try {
      return decryptData(record.apiKeyEnc);
    } catch (error) {
      logger.error({ err: error }, "Failed to decrypt stored partner API key");
      return null;
    }
  }
  return record.apiKey;
}

export function hasApiKey(record: {
  apiKeyHash: string | null;
  apiKeyEnc: string | null;
  apiKey: string | null;
}): boolean {
  return Boolean(record.apiKeyHash || record.apiKeyEnc || record.apiKey);
}

/**
 * Resolves the owner of a presented key.
 *
 * Hashed keys are found with a single indexed lookup. A legacy plaintext key is
 * migrated in place on its first successful use, so existing partner integrations
 * keep working without a rotation.
 */
export async function resolveApiKeyOwner(
  raw: string,
): Promise<{ id: string } | null> {
  const key = raw.trim();
  if (!key) return null;

  const byHash = await prisma.user.findUnique({
    where: { apiKeyHash: hashApiKey(key) },
    select: { id: true },
  });
  if (byHash) return byHash;

  const legacy = await prisma.user.findFirst({
    where: { apiKey: key },
    select: { id: true },
  });
  if (!legacy) return null;

  try {
    await prisma.user.update({
      where: { id: legacy.id },
      data: apiKeyColumns(key),
    });
    logger.info(
      { userId: legacy.id },
      "Partner API key migrated to hashed storage",
    );
  } catch (error) {
    // A failed migration must not reject a valid key: the plaintext column still matches.
    logger.error(
      { err: error, userId: legacy.id },
      "Failed to migrate partner API key",
    );
  }

  return legacy;
}
