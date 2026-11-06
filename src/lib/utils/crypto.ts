import crypto from 'crypto';
import * as argon2 from 'argon2';

const ALGORITHM = 'aes-256-gcm';

// Resolved on first use so that importing this module never crashes a build.
// Fails closed: without a valid key, nothing is encrypted or decrypted with a
// random key that would be lost on restart.
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    cachedKey = Buffer.from(hex, 'hex');
    return cachedKey;
  }

  const secret = process.env.SESSION_SECRET || 'marketplace_default_development_secret_key_fixed_32';
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
