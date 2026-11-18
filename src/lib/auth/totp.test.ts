import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  totpAt,
  verifyTotp,
} from "./totp";

// RFC 6238 Appendix B: ASCII "12345678901234567890", SHA1, 8 digits.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("matches the RFC 6238 test vectors", () => {
    const vectors: Array<[number, string]> = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
      [20000000000, "65353130"],
    ];

    for (const [seconds, expected] of vectors) {
      expect(totpAt(RFC_SECRET, seconds * 1000, 30, 8)).toBe(expected);
    }
  });

  it("round-trips base32", () => {
    const buffer = Buffer.from("12345678901234567890", "ascii");
    expect(base32Encode(buffer)).toBe(RFC_SECRET);
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
  });

  it("generates a 32-character secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(secret);
  });

  it("accepts the current step and rejects a wrong code", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = totpAt(secret, now);

    expect(verifyTotp(secret, code, { timestampMs: now })).toBe(true);
    expect(verifyTotp(secret, "000000", { timestampMs: now })).toBe(false);
    expect(verifyTotp(secret, "abc123", { timestampMs: now })).toBe(false);
  });

  it("tolerates one step of clock skew but not more", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const previousStep = totpAt(secret, now - 30_000);

    expect(verifyTotp(secret, previousStep, { timestampMs: now })).toBe(true);
    expect(verifyTotp(secret, previousStep, { timestampMs: now + 90_000 })).toBe(false);
  });

  it("builds an otpauth URI with issuer and digits", () => {
    const url = buildOtpAuthUrl({
      secret: "JBSWY3DPEHPK3PXP",
      accountName: "admin@digishop.com",
      issuer: "Digishop",
    });

    expect(url.startsWith("otpauth://totp/Digishop%3Aadmin%40digishop.com?")).toBe(true);
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });
});

describe("recovery codes", () => {
  it("generates unique, human-readable codes", () => {
    const codes = generateRecoveryCodes(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    }
  });

  it("normalizes case, spaces and dashes", () => {
    expect(normalizeRecoveryCode(" k7m2q-9xprt ")).toBe("K7M2Q9XPRT");
    expect(normalizeRecoveryCode("K7M2Q 9XPRT")).toBe("K7M2Q9XPRT");
  });
});
