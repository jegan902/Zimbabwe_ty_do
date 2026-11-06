import { describe, expect, it } from "vitest";
import {
  describeShape,
  findArray,
  getField,
  parseAmount,
  pickBoolean,
  pickNumber,
  pickString,
} from "./parse";

describe("getField", () => {
  it("matches exact keys first", () => {
    expect(getField({ price: 100, cost: 200 }, ["price"])).toBe(100);
  });

  it("matches regardless of case and separators", () => {
    const record = { Product_ID: "abc" };
    expect(getField(record, ["product_id"])).toBe("abc");
    expect(getField(record, ["productId"])).toBe("abc");
    expect(getField(record, ["PRODUCT-ID"])).toBe("abc");
  });

  it("returns undefined when nothing matches", () => {
    expect(getField({ foo: 1 }, ["bar"])).toBeUndefined();
  });

  it("handles null records", () => {
    expect(getField(null, ["x"])).toBeUndefined();
  });
});

describe("pickString", () => {
  it("trims strings", () => {
    expect(pickString({ name: "  Hello  " }, ["name"])).toBe("Hello");
  });

  it("returns null for empty strings", () => {
    expect(pickString({ name: "   " }, ["name"])).toBeNull();
  });

  it("coerces finite numbers", () => {
    expect(pickString({ id: 42 }, ["id"])).toBe("42");
  });

  it("ignores objects and arrays", () => {
    expect(pickString({ id: { nested: 1 } }, ["id"])).toBeNull();
  });
});

describe("pickNumber", () => {
  it("reads numeric strings", () => {
    expect(pickNumber({ stock: "15" }, ["stock"])).toBe(15);
  });

  it("strips formatting characters", () => {
    expect(pickNumber({ stock: "1,250" }, ["stock"])).toBe(1250);
  });

  it("returns null for unparsable values", () => {
    expect(pickNumber({ stock: "abc" }, ["stock"])).toBeNull();
  });
});

describe("pickBoolean", () => {
  it("reads real booleans", () => {
    expect(pickBoolean({ active: true }, ["active"])).toBe(true);
    expect(pickBoolean({ active: false }, ["active"])).toBe(false);
  });

  it("reads common textual flags", () => {
    expect(pickBoolean({ status: "active" }, ["status"])).toBe(true);
    expect(pickBoolean({ status: "disabled" }, ["status"])).toBe(false);
  });

  it("returns null for unknown text", () => {
    expect(pickBoolean({ status: "banana" }, ["status"])).toBeNull();
  });
});

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount(100000)).toBe("100000");
    expect(parseAmount("100000")).toBe("100000");
  });

  it("parses dot-grouped Vietnamese amounts", () => {
    expect(parseAmount("100.000")).toBe("100000");
    expect(parseAmount("1.000.000")).toBe("1000000");
  });

  it("parses comma-grouped amounts", () => {
    expect(parseAmount("1,000,000")).toBe("1000000");
  });

  it("parses decimal amounts with a comma separator", () => {
    expect(parseAmount("10,50")).toBe("10.50");
  });

  it("parses decimal amounts with a dot separator", () => {
    expect(parseAmount("10.5")).toBe("10.5");
  });

  it("handles both separators using the last as decimal", () => {
    expect(parseAmount("1.234,56")).toBe("1234.56");
    expect(parseAmount("1,234.56")).toBe("1234.56");
  });

  it("strips currency markers and spaces", () => {
    expect(parseAmount("110.000 đ")).toBe("110000");
    expect(parseAmount("₫ 50.000")).toBe("50000");
    expect(parseAmount("100 000")).toBe("100000");
  });

  it("keeps a negative sign", () => {
    expect(parseAmount("-50000")).toBe("-50000");
  });

  it("returns null for junk instead of inventing a number", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("lien he")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount({})).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe("findArray", () => {
  it("finds a top-level array", () => {
    expect(findArray([1, 2, 3], ["products"])).toEqual([1, 2, 3]);
  });

  it("finds a named array", () => {
    expect(findArray({ products: ["a"] }, ["products"])).toEqual(["a"]);
  });

  it("finds an array nested in a data envelope", () => {
    expect(findArray({ data: { products: [1] } }, ["products"])).toEqual([1]);
  });

  it("finds an array directly under data", () => {
    expect(findArray({ data: [1, 2] }, ["products", "data"])).toEqual([1, 2]);
  });

  it("returns null when absent", () => {
    expect(findArray({ foo: 1 }, ["products"])).toBeNull();
    expect(findArray("text", ["products"])).toBeNull();
  });
});

describe("describeShape", () => {
  it("reports object keys without values", () => {
    // Only key names are exposed, never values, so diagnostics are log-safe.
    expect(describeShape({ status: "success", trans_id: "x" })).toBe(
      "object{status,trans_id}"
    );
  });

  it("reports array length and element shape", () => {
    expect(describeShape([])).toBe("array(empty)");
    expect(describeShape([{ a: 1 }])).toBe("array(1) of object{a}");
  });

  it("reports primitives", () => {
    expect(describeShape("text")).toBe("string");
    expect(describeShape(null)).toBe("null");
  });
});