import Decimal from "decimal.js";

// Money is always handled with 19,2 storage and 4dp intermediate rates.
// Binary floating point is never used for currency in this codebase.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 });

export type MoneyInput = Decimal | string | number;

export const ZERO = "0.00";
export const MONEY_SCALE = 2;
export const RATE_SCALE = 4;

export function d(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/** Money rounding: half-up to 2 decimals, the unit customers actually see. */
export function roundMoney(value: MoneyInput): Decimal {
  return d(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function roundRate(value: MoneyInput): Decimal {
  return d(value).toDecimalPlaces(RATE_SCALE, Decimal.ROUND_HALF_UP);
}

/** Serialised form persisted to a Decimal(19,2) column. */
export function money(value: MoneyInput): string {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

/** Serialised form persisted to a Decimal(10,4) column. */
export function rate(value: MoneyInput): string {
  return roundRate(value).toFixed(RATE_SCALE);
}

/**
 * Selling price from a supplier cost and a profit policy.
 *
 * PERCENTAGE: cost * (1 + value/100)   e.g. 100000 @ 10% -> 110000
 * FIXED:      cost + value             e.g. 100000 + 10000 -> 110000
 *
 * The result is rounded to whole money units so customers never see fractions,
 * but it never rounds down below cost, which would sell at a loss.
 */
export function computeSellingPrice(
  cost: MoneyInput,
  profitType: "PERCENTAGE" | "FIXED",
  profitValue: MoneyInput
): Decimal {
  const base = d(cost);
  const value = d(profitValue);

  const raw =
    profitType === "PERCENTAGE"
      ? base.mul(d(1).plus(value.div(100)))
      : base.plus(value);

  const rounded = roundMoney(raw);
  if (rounded.lessThan(base)) return roundMoney(base);
  return rounded;
}

export function computeProfit(cost: MoneyInput, sellingPrice: MoneyInput): Decimal {
  return roundMoney(d(sellingPrice).minus(d(cost)));
}

/** Realised profit margin in percent, safe against a zero cost. */
export function computeProfitRate(cost: MoneyInput, sellingPrice: MoneyInput): Decimal {
  const base = d(cost);
  if (base.isZero()) return roundRate(0);
  return roundRate(d(sellingPrice).minus(base).div(base).mul(100));
}

export function minMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return d(a).lessThan(d(b)) ? d(a) : d(b);
}

export function isPositive(value: MoneyInput): boolean {
  return d(value).greaterThan(0);
}

export function isZero(value: MoneyInput): boolean {
  return d(value).isZero();
}

/** Vietnamese Dong is displayed without fractional digits. */
export function formatVnd(value: MoneyInput): string {
  const amount = roundMoney(value);
  const negative = amount.isNegative();
  const digits = amount.abs().toFixed(0);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}đ`;
}

export function formatNumber(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}