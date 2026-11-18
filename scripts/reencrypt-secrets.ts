/**
 * Re-encrypts data at rest after `ENCRYPTION_KEY` changes.
 *
 * Covered columns: `Supplier.apiKey` (format `enc:v1:<iv>:<tag>:<data>`) and
 * `User.apiKeyEnc` (raw `<iv>:<tag>:<data>`). Partner API keys keep working either
 * way (lookup goes through `apiKeyHash`), but without this step the owner can no
 * longer read their key back and the system silently rotates it.
 *
 * Usage — the old key is supplied explicitly, the new one is the current .env:
 *
 *   # old key was a real ENCRYPTION_KEY value
 *   OLD_ENCRYPTION_KEY=<64 hex> npm run db:reencrypt-secrets
 *
 *   # old key was derived from SESSION_SECRET (ENCRYPTION_KEY was empty)
 *   OLD_KEY_FROM_SESSION_SECRET=true npm run db:reencrypt-secrets
 *
 * Rows that already decrypt with the current key are skipped, so re-running the
 * script is harmless.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { prisma } from "../src/lib/utils/db";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "enc:v1:";

function keyFromSessionSecret(): Buffer {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET missing or shorter than 32 chars; cannot derive the old key",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function resolveNewKey(): Buffer {
  const hex = (process.env.ENCRYPTION_KEY ?? "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  if (hex) throw new Error("ENCRYPTION_KEY is not 64 hex characters");
  console.warn(
    "[reencrypt] ENCRYPTION_KEY is empty: falling back to the SESSION_SECRET-derived key.",
  );
  return keyFromSessionSecret();
}

function resolveOldKey(): Buffer {
  const hex = (process.env.OLD_ENCRYPTION_KEY ?? "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  if (hex) throw new Error("OLD_ENCRYPTION_KEY is not 64 hex characters");

  const fromSecret = (process.env.OLD_KEY_FROM_SESSION_SECRET ?? "").toLowerCase();
  if (["1", "true", "yes"].includes(fromSecret)) return keyFromSessionSecret();

  throw new Error(
    "Missing old key: set OLD_ENCRYPTION_KEY=<64 hex> or OLD_KEY_FROM_SESSION_SECRET=true",
  );
}

function decryptWith(payload: string, key: Buffer): string | null {
  const parts = payload.split(":");
  if (parts.length !== 3) return null;

  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function encryptWith(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

type Outcome = "rotated" | "alreadyCurrent" | "unreadable";

function rotate(
  stored: string,
  oldKey: Buffer,
  newKey: Buffer,
  stripPrefix: boolean,
): { outcome: Outcome; value?: string } {
  const payload = stripPrefix ? stored.slice(ENCRYPTED_PREFIX.length) : stored;

  const plaintext = decryptWith(payload, oldKey);
  if (plaintext !== null) {
    const data = encryptWith(plaintext, newKey);
    return { outcome: "rotated", value: stripPrefix ? `${ENCRYPTED_PREFIX}${data}` : data };
  }

  // Already rotated by an earlier run (or written with the new key).
  if (decryptWith(payload, newKey) !== null) return { outcome: "alreadyCurrent" };
  return { outcome: "unreadable" };
}

async function main() {
  const newKey = resolveNewKey();
  const oldKey = resolveOldKey();

  if (oldKey.equals(newKey)) {
    console.log("[reencrypt] old key equals the current key: nothing to do");
    return;
  }

  const summary = {
    suppliersRotated: 0,
    suppliersSkipped: 0,
    suppliersUnreadable: [] as string[],
    apiKeysRotated: 0,
    apiKeysSkipped: 0,
    apiKeysUnreadable: [] as string[],
  };

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, apiKey: true },
  });

  for (const supplier of suppliers) {
    const stored = supplier.apiKey ?? "";
    if (!stored) continue;

    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
      // Written before encryption existed: encrypt it with the current key.
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { apiKey: `${ENCRYPTED_PREFIX}${encryptWith(stored, newKey)}` },
      });
      summary.suppliersRotated += 1;
      continue;
    }

    const { outcome, value } = rotate(stored, oldKey, newKey, true);
    if (outcome === "rotated" && value) {
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { apiKey: value },
      });
      summary.suppliersRotated += 1;
    } else if (outcome === "alreadyCurrent") {
      summary.suppliersSkipped += 1;
    } else {
      summary.suppliersUnreadable.push(supplier.name);
    }
  }

  const users = await prisma.user.findMany({
    where: { apiKeyEnc: { not: null } },
    select: { id: true, email: true, apiKeyEnc: true },
  });

  for (const user of users) {
    const { outcome, value } = rotate(user.apiKeyEnc ?? "", oldKey, newKey, false);
    if (outcome === "rotated" && value) {
      await prisma.user.update({
        where: { id: user.id },
        data: { apiKeyEnc: value },
      });
      summary.apiKeysRotated += 1;
    } else if (outcome === "alreadyCurrent") {
      summary.apiKeysSkipped += 1;
    } else {
      summary.apiKeysUnreadable.push(user.email);
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (summary.suppliersUnreadable.length > 0 || summary.apiKeysUnreadable.length > 0) {
    console.error(
      "[reencrypt] Some rows decrypt with neither key. Their credentials must be re-entered (supplier) or will be rotated on next read (partner API key).",
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
