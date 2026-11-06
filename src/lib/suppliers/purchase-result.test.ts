import { describe, expect, it } from "vitest";
import { classifyPurchaseResponse } from "./purchase-result";

/**
 * These tests encode the platform's core financial safety rule:
 * a purchase is only successful when the supplier proves it.
 */

describe("classifyPurchaseResponse — definitive failures", () => {
  it("treats HTTP 400 as a definitive failure", () => {
    const outcome = classifyPurchaseResponse(400, "...", 1);
    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") expect(outcome.definitive).toBe(true);
  });

  it("treats HTTP 401 as an auth failure", () => {
    const outcome = classifyPurchaseResponse(401, "", 1);
    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") {
      expect(outcome.errorCode).toBe("SUPPLIER_HTTP_401");
      expect(outcome.definitive).toBe(true);
    }
  });

  it("treats HTTP 429 as a definitive rate-limit failure", () => {
    const outcome = classifyPurchaseResponse(429, "", 1);
    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") expect(outcome.errorCode).toBe("SUPPLIER_RATE_LIMITED");
  });

  it("treats an explicit supplier rejection as definitive", () => {
    const body = JSON.stringify({ status: "error", msg: "Hết hàng" });
    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") {
      expect(outcome.definitive).toBe(true);
      expect(outcome.message).toBe("Hết hàng");
    }
  });

  it("honours success:false even with a 200 status", () => {
    const body = JSON.stringify({ success: false, message: "Sai coupon" });
    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("FAILED");
  });
});

describe("classifyPurchaseResponse — unknown outcomes", () => {
  it("treats HTTP 500 as unknown, never failed", () => {
    // The order may already exist upstream, so refunding would be unsafe.
    const outcome = classifyPurchaseResponse(500, "Internal Server Error", 1);
    expect(outcome.status).toBe("UNKNOWN");
  });

  it("treats HTTP 503 as unknown", () => {
    expect(classifyPurchaseResponse(503, "", 1).status).toBe("UNKNOWN");
  });

  it("treats an HTML 200 response as unknown", () => {
    const outcome = classifyPurchaseResponse(200, "<!DOCTYPE html><html></html>", 1);
    expect(outcome.status).toBe("UNKNOWN");
    if (outcome.status === "UNKNOWN") {
      expect(outcome.errorCode).toBe("SUPPLIER_NON_JSON_RESPONSE");
    }
  });

  it("treats an empty body as unknown", () => {
    expect(classifyPurchaseResponse(200, "", 1).status).toBe("UNKNOWN");
  });

  it("treats a JSON array body as unknown", () => {
    expect(classifyPurchaseResponse(200, "[]", 1).status).toBe("UNKNOWN");
  });

  it("treats a success without an order id as unknown", () => {
    const body = JSON.stringify({ status: "success", data: ["user|pass"] });
    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("UNKNOWN");
    if (outcome.status === "UNKNOWN") {
      expect(outcome.errorCode).toBe("SUPPLIER_MISSING_ORDER_ID");
    }
  });

  it("treats an order id without credentials as unknown", () => {
    const body = JSON.stringify({ status: "success", trans_id: "JF123", data: [] });
    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("UNKNOWN");
    if (outcome.status === "UNKNOWN") {
      expect(outcome.errorCode).toBe("SUPPLIER_MISSING_CREDENTIALS");
    }
  });
});

describe("classifyPurchaseResponse — success", () => {
  it("accepts the documented success response shape", () => {
    const body = JSON.stringify({
      status: "success",
      msg: "Tạo đơn hàng thành công!",
      trans_id: "JF465f728224ce11",
      data: ["1000040304952|GUTJXYIFPWLHCNDOMBRKVAQESZ"],
    });

    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("SUCCESS");
    if (outcome.status === "SUCCESS") {
      expect(outcome.supplierOrderId).toBe("JF465f728224ce11");
      expect(outcome.credentials).toHaveLength(1);
      expect(outcome.credentials[0]).toBe("1000040304952|GUTJXYIFPWLHCNDOMBRKVAQESZ");
    }
  });

  it("returns every delivered credential", () => {
    const body = JSON.stringify({
      status: "success",
      trans_id: "T1",
      data: ["a|1", "b|2", "c|3"],
    });
    const outcome = classifyPurchaseResponse(200, body, 3);
    expect(outcome.status).toBe("SUCCESS");
    if (outcome.status === "SUCCESS") expect(outcome.credentials).toHaveLength(3);
  });

  it("reports a short delivery without inventing entries", () => {
    // Asked for 3, received 2: the count must stay truthful.
    const body = JSON.stringify({ status: "success", trans_id: "T1", data: ["a|1", "b|2"] });
    const outcome = classifyPurchaseResponse(200, body, 3);
    expect(outcome.status).toBe("SUCCESS");
    if (outcome.status === "SUCCESS") expect(outcome.credentials).toHaveLength(2);
  });

  it("accepts alternative order id field names", () => {
    const body = JSON.stringify({ status: "success", order_id: "ORG-9", data: ["x|y"] });
    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("SUCCESS");
    if (outcome.status === "SUCCESS") expect(outcome.supplierOrderId).toBe("ORG-9");
  });

  it("accepts object credentials without assuming field names", () => {
    const body = JSON.stringify({
      status: "success",
      trans_id: "T2",
      data: [{ username: "u1", password: "p1" }],
    });
    const outcome = classifyPurchaseResponse(200, body, 1);
    expect(outcome.status).toBe("SUCCESS");
    if (outcome.status === "SUCCESS") expect(outcome.credentials[0]).toBe("u1|p1");
  });

  it("never leaks credential values into the raw diagnostic", () => {
    const body = JSON.stringify({ status: "success", trans_id: "T3", data: ["secretuser|secretpass"] });
    const outcome = classifyPurchaseResponse(200, body, 1);
    const raw = JSON.stringify(outcome.raw);
    expect(raw).not.toContain("secretuser");
    expect(raw).not.toContain("secretpass");
  });
});