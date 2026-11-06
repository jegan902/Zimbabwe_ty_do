/**
 * Tolerant parsing helpers for supplier payloads.
 *
 * The supplier's response shape is NOT verified: no authenticated request has
 * been executed, so field names below are candidate aliases, not documentation.
 * Everything here is therefore defensive:
 *   - unknown shapes never throw a type error, they produce a diagnostic
 *   - missing required fields raise an explicit "unverified shape" error that
 *     lists the keys that WERE present (keys are safe; values may be sensitive)
 *   - nothing is fabricated when a value is absent
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Reads the first present field from a record using case/underscore-insensitive
 * matching, so `product_id`, `productId` and `PRODUCT-ID` all resolve.
 */
export function getField(
  record: Record<string, unknown> | null,
  candidates: readonly string[]
): unknown {
  if (!record) return undefined;

  const wanted = new Set(candidates.map(normalizeKey));

  // Exact hit first, so an explicit name always wins over a loose match.
  for (const candidate of candidates) {
    if (candidate in record) return record[candidate];
  }

  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizeKey(key))) return value;
  }
  return undefined;
}

export function pickString(
  record: Record<string, unknown> | null,
  candidates: readonly string[]
): string | null {
  const value = getField(record, candidates);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function pickNumber(
  record: Record<string, unknown> | null,
  candidates: readonly string[]
): number | null {
  const value = getField(record, candidates);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function pickBoolean(
  record: Record<string, unknown> | null,
  candidates: readonly string[]
): boolean | null {
  const value = getField(record, candidates);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "active"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "inactive", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

/**
 * Parses a monetary value into a plain decimal string.
 *
 * Vietnamese supplier panels commonly render amounts as "100.000" or "100,000".
 * The heuristic below is documented rather than clever:
 *   - both separators present  -> the LAST one is the decimal separator
 *   - a single separator used in groups of exactly 3 -> thousands separator
 *   - otherwise               -> decimal separator
 * The result is never rounded here; the caller applies money rounding.
 */
export function parseAmount(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== "string") return null;

  let raw = value.trim();
  if (!raw) return null;

  // Strip currency markers, spaces and non-breaking spaces.
  raw = raw.replace(/[₫đĐ$€£\s\u00a0]/gi, "").replace(/[^\d.,-]/g, "");
  if (!raw) return null;

  const negative = raw.startsWith("-");
  if (negative) raw = raw.slice(1);
  if (!/^\d[\d.,]*$/.test(raw)) return null;

  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");

  let normalized: string;

  if (hasDot && hasComma) {
    normalized =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else {
    const separator = hasDot ? "." : hasComma ? "," : null;
    if (!separator) {
      normalized = raw;
    } else {
      const parts = raw.split(separator);
      const looksGrouped = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
      normalized = looksGrouped ? parts.join("") : parts.join(".");
    }
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? `-${normalized}` : normalized;
}

/**
 * Looks up a collection across the common envelope shapes suppliers use.
 * Only examines keys we name explicitly; it never guesses arbitrary field names.
 */
export function findArray(
  payload: unknown,
  candidates: readonly string[],
  maxDepth = 2
): unknown[] | null {
  const rootArray = asArray(payload);
  if (rootArray) return rootArray;

  const root = asRecord(payload);
  if (!root) return null;

  const direct = getField(root, candidates);
  const directArray = asArray(direct);
  if (directArray) return directArray;
  const directRecord = asRecord(direct);
  if (directRecord) {
    for (const candidate of candidates) {
      const nested = asArray(getField(directRecord, [candidate]));
      if (nested) return nested;
    }
  }

  if (maxDepth > 0) {
    for (const envelope of ["data", "result", "payload", "response"]) {
      const nestedRecord = asRecord(root[envelope]);
      if (nestedRecord) {
        const found = findArray(nestedRecord, candidates, maxDepth - 1);
        if (found) return found;
      }
    }
  }

  return null;
}

/** Keys of a payload, for diagnostics. Keys are never secret; values are. */
export function describeShape(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(empty)";
    return `array(${value.length}) of ${describeShape(value[0])}`;
  }
  const record = asRecord(value);
  if (record) {
    const keys = Object.keys(record).slice(0, 25);
    return `object{${keys.join(",")}}`;
  }
  return typeof value;
}

export const UNVERIFIED_SHAPE = "SUPPLIER_UNVERIFIED_SHAPE";

export class UnverifiedShapeError extends Error {
  readonly code = UNVERIFIED_SHAPE;
  constructor(
    message: string,
    readonly observed: string
  ) {
    super(message);
    this.name = "UnverifiedShapeError";
    Object.setPrototypeOf(this, UnverifiedShapeError.prototype);
  }
}