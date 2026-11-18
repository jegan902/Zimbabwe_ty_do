import crypto from 'crypto';
import * as argon2 from 'argon2';

const ALGORITHM = 'aes-256-gcm';

// Resolved on first use so that importing this module never crashes a build.
// Fails closed: a missing or malformed key throws instead of encrypting with a
// random (and therefore unrecoverable) key or with a key baked into the source.
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    cachedKey = Buffer.from(hex, 'hex');
    return cachedKey;
  }

  if (hex) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (openssl rand -hex 32)');
  }

  // No hardcoded default: a key that ships in the source is public knowledge and
  // would make every stored credential readable to anyone with a database dump.
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'Missing ENCRYPTION_KEY (64 hex chars) and SESSION_SECRET (>= 32 chars); refusing to encrypt with a weak key'
    );
  }

  if (process.env.NODE_ENV === 'production') {
    // Existing supplier credentials were encrypted with this derived key, so throwing
    // here would take the integration down. The startup check in instrumentation.ts
    // reports the misconfiguration; rotating SESSION_SECRET must be preceded by
    // setting ENCRYPTION_KEY and re-saving the stored credentials.
    console.error(
      '[crypto] ENCRYPTION_KEY is not set: falling back to a key derived from SESSION_SECRET. Set ENCRYPTION_KEY before rotating SESSION_SECRET.'
    );
  }

  cachedKey = crypto.createHash('sha256').update(secret).digest();
  return cachedKey;
}

export function encryptData(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptData(combined: string): string {
  const parts = combined.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function pepperedPassword(password: string, pepper?: string): string {
  return password + (pepper ?? process.env.ARGON2_SECRET ?? '');
}

export function hashPassword(password: string, pepper?: string): Promise<string> {
  return argon2.hash(pepperedPassword(password, pepper), { type: argon2.argon2id });
}

export async function verifyPassword(
  password: string,
  hash: string,
  pepper?: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, pepperedPassword(password, pepper));
  } catch {
    return false;
  }
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function hashIdempotencyKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = Buffer.from(generateWebhookSignature(payload, secret), 'hex');
  const received = Buffer.from(signature, 'hex');

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(received, expected);
}
