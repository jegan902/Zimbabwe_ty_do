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

/** Lifetime of the "password OK, waiting for the 2FA code" token. */
export const LOGIN_CHALLENGE_TTL_SECONDS = 5 * 60;

interface LoginChallengePayload {
  sub: string;
  exp: number;
  nonce: string;
}

/**
 * Signed, short-lived proof that the password step already succeeded.
 *
 * Carries no privileges on its own: it can only be exchanged for a session by
 * presenting a valid TOTP or recovery code, which is what keeps the second factor
 * meaningful. Stateless on purpose so a login does not need a DB row or Redis key.
 */
export function signLoginChallenge(userId: string, ttlSeconds = LOGIN_CHALLENGE_TTL_SECONDS): string {
  const payload: LoginChallengePayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

/** Returns the user id only when the signature and the expiry are both valid. */
export function verifyLoginChallenge(token: string): { userId: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  if (!safeEqual(expected, signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as LoginChallengePayload;
    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}