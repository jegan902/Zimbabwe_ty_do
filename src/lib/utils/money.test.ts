import { describe, expect, it } from "vitest";
import {
  computeProfit,
  computeProfitRate,
  computeSellingPrice,
  formatVnd,
  money,
  roundMoney,
  rate,
} from "./money";

describe("computeSellingPrice", () => {
  it("applies a percentage markup", () => {
    // Documented example: 100.000 cost at 10% must sell for 110.000.
    expect(computeSellingPrice("100000", "PERCENTAGE", "10").toFixed(2)).toBe("110000.00");
  });

  it("recalculates after a supplier price increase", () => {
    // Documented example: cost rises to 120.000, 10% markup -> 132.000.
    expect(computeSellingPrice("120000", "PERCENTAGE", "10").toFixed(2)).toBe("132000.00");
  });

  it("applies a fixed markup", () => {
    expect(computeSellingPrice("100000", "FIXED", "10000").toFixed(2)).toBe("110000.00");
  });

  it("supports a zero markup", () => {
    expect(computeSellingPrice("50000", "PERCENTAGE", "0").toFixed(2)).toBe("50000.00");
  });

  it("supports fractional percentages without float drift", () => {
    expect(computeSellingPrice("100000", "PERCENTAGE", "7.5").toFixed(2)).toBe("107500.00");
  });

  it("never prices below cost", () => {
    // A negative profit value must not produce a loss-making price.
    expect(computeSellingPrice("100000", "FIXED", "-20000").toFixed(2)).toBe("100000.00");
  });

  it("rounds half-up at the money boundary", () => {
    expect(computeSellingPrice("33333", "PERCENTAGE", "10").toFixed(2)).toBe("36666.30");
  });
});

describe("profit math", () => {
  it("computes gross profit", () => {
    expect(computeProfit("100000", "110000").toFixed(2)).toBe("10000.00");
  });

  it("computes profit rate", () => {
    expect(computeProfitRate("100000", "110000").toFixed(4)).toBe("10.0000");
  });

  it("returns zero rate instead of dividing by zero cost", () => {
    expect(computeProfitRate("0", "50000").toFixed(4)).toBe("0.0000");
  });

  it("reports a loss as a negative profit", () => {
    expect(computeProfit("120000", "110000").toFixed(2)).toBe("-10000.00");
  });
});

describe("decimal handling", () => {
  it("avoids binary floating point error", () => {
    // 0.1 + 0.2 in float is 0.30000000000000004.
    expect(money("0.1").toString()).toBe("0.10");
    const sum = Number(roundMoney("0.1").plus(roundMoney("0.2")).toFixed(2));
    expect(sum).toBe(0.3);
  });

  it("rounds money half-up", () => {
    expect(money("1000.005")).toBe("1000.01");
    expect(money("1000.004")).toBe("1000.00");
  });

  it("keeps four decimals for rates", () => {
    expect(rate("10.123456")).toBe("10.1235");
  });
});

describe("formatVnd", () => {
  it("groups thousands with dots", () => {
    expect(formatVnd("110000")).toBe("110.000đ");
    expect(formatVnd("1000000")).toBe("1.000.000đ");
  });

  it("formats small and zero amounts", () => {
    expect(formatVnd("0")).toBe("0đ");
    expect(formatVnd("999")).toBe("999đ");
  });

  it("keeps the negative sign", () => {
    expect(formatVnd("-25000")).toBe("-25.000đ");
  });
});