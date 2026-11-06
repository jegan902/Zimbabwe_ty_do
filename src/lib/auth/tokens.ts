import crypto from "crypto";

const MIN_SECRET_LENGTH = 32;

// Fails closed: a missing or weak SESSION_SECRET stops session hashing instead of falling back.
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

/** Opaque random token. Only its HMAC is stored in the database. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Constant-time comparison for CSRF tokens and other opaque values. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}