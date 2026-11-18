import crypto from "node:crypto";

/**
 * TOTP (RFC 6238) with the parameters every authenticator app supports:
 * HMAC-SHA1, 30-second step, 6 digits. No dependency: the algorithm is ~30 lines
 * and avoiding a third-party TOTP package removes a supply-chain surface from the
 * one flow that guards the admin portal.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
/** Accept the previous/next step so a slightly skewed phone clock still works. */
export const TOTP_DEFAULT_WINDOW = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** New 160-bit secret, base32 encoded (what the QR code carries). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);

  const digest = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpAt(
  secret: string,
  timestampMs: number = Date.now(),
  period = TOTP_PERIOD_SECONDS,
  digits = TOTP_DIGITS,
): string {
  const counter = Math.floor(timestampMs / 1000 / period);
  return hotp(base32Decode(secret), counter, digits);
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyTotp(
  secret: string,
  code: string,
  options: { window?: number; timestampMs?: number } = {},
): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(normalized)) return false;

  const { window = TOTP_DEFAULT_WINDOW, timestampMs = Date.now() } = options;
  const counter = Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);
  const key = base32Decode(secret);

  for (let drift = -window; drift <= window; drift += 1) {
    if (counter + drift < 0) continue;
    const expected = hotp(key, counter + drift);
    if (constantTimeEqual(expected, normalized)) return true;
  }
  return false;
}

/** URI consumed by Google Authenticator / 1Password / Authy. */
export function buildOtpAuthUrl(params: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Human-readable single-use codes, e.g. `K7M2Q-9XPRT`. */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let raw = "";
    for (let j = 0; j < 10; j += 1) {
      raw += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
    }
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

/** Trims formatting so a user can paste `k7m2q 9xprt` and still be accepted. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
