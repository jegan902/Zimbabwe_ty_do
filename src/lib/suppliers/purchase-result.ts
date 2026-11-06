import type { PurchaseOutcome } from "./supplier.interface";
import { asRecord, describeShape, findArray, getField, pickString } from "./parse";

/**
 * Purchase-response classification.
 *
 * This is the single most safety-critical pure function in the supplier layer:
 * it decides whether money was actually spent. It is deliberately separated
 * from the adapter so the rules are auditable and unit-testable without any
 * network access.
 *
 * Guiding rule: a success is only declared when the supplier returned both an
 * order id AND at least one delivered credential. Anything ambiguous becomes
 * UNKNOWN, which forces reconciliation instead of an automatic retry or refund.
 */

export function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<?php");
}

function decode(text: string): { json: unknown; isJson: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { json: null, isJson: false };
  try {
    return { json: JSON.parse(trimmed), isJson: true };
  } catch {
    return { json: null, isJson: false };
  }
}

function extractCredentials(payload: unknown): string[] {
  const array = findArray(payload, ["data", "accounts", "account", "items"]);
  if (!array) return [];

  return array
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      const record = asRecord(entry);
      if (!record) return "";
      // Join only the primitive strings the supplier actually sent. No field
      // names are assumed, so an unexpected shape still yields usable text.
      return Object.values(record)
        .filter((value) => typeof value === "string")
        .join("|")
        .trim();
    })
    .filter((value) => value.length > 0);
}

export function classifyPurchaseResponse(
  status: number,
  text: string,
  expectedQuantity: number
): PurchaseOutcome {
  // Definitive client-side rejections: no order can have been created.
  if (status === 400 || status === 401 || status === 403 || status === 422) {
    return {
      status: "FAILED",
      errorCode: `SUPPLIER_HTTP_${status}`,
      message:
        status === 401
          ? "Nhà cung cấp từ chối API key"
          : "Nhà cung cấp từ chối yêu cầu mua hàng",
      definitive: true,
      raw: { status },
    };
  }

  if (status === 429) {
    return {
      status: "FAILED",
      errorCode: "SUPPLIER_RATE_LIMITED",
      message: "Nhà cung cấp giới hạn tần suất, vui lòng thử lại sau",
      definitive: true,
      raw: { status },
    };
  }

  // A 5xx can be raised after the order row was already written upstream.
  if (status >= 500) {
    return {
      status: "UNKNOWN",
      errorCode: `SUPPLIER_HTTP_${status}`,
      message: "Nhà cung cấp gặp lỗi máy chủ trong khi xử lý giao dịch",
      raw: { status },
    };
  }

  if (status < 200 || status >= 300) {
    return {
      status: "UNKNOWN",
      errorCode: `SUPPLIER_HTTP_${status}`,
      message: "Phản hồi không xác định từ nhà cung cấp",
      raw: { status },
    };
  }

  const { json, isJson } = decode(text);

  if (!isJson) {
    return {
      status: "UNKNOWN",
      errorCode: "SUPPLIER_NON_JSON_RESPONSE",
      message: "Nhà cung cấp trả về dữ liệu không phải JSON",
      raw: { status, shape: looksLikeHtml(text) ? "html" : "text" },
    };
  }

  const record = asRecord(json);
  if (!record) {
    return {
      status: "UNKNOWN",
      errorCode: "SUPPLIER_MALFORMED_RESPONSE",
      message: "Không đọc được phản hồi của nhà cung cấp",
      raw: { status, shape: describeShape(json) },
    };
  }

  const rawStatus = pickString(record, ["status", "success", "code", "error"]);
  const message = pickString(record, ["msg", "message", "error", "error_message"]) ?? undefined;
  const statusText = (rawStatus ?? "").toLowerCase();

  const explicitFailure =
    ["error", "failed", "fail", "false", "0"].includes(statusText) ||
    getField(record, ["success"]) === false;

  const supplierOrderId =
    pickString(record, ["trans_id", "transId", "transaction_id", "order_id", "orderId"]) ?? null;

  if (explicitFailure) {
    return {
      status: "FAILED",
      errorCode: "SUPPLIER_REJECTED",
      message: message ?? "Nhà cung cấp báo giao dịch thất bại",
      definitive: true,
      raw: { status: rawStatus, hasOrderId: Boolean(supplierOrderId) },
    };
  }

  if (!supplierOrderId) {
    return {
      status: "UNKNOWN",
      errorCode: "SUPPLIER_MISSING_ORDER_ID",
      message: message ?? "Phản hồi thiếu mã giao dịch của nhà cung cấp",
      raw: { shape: describeShape(json), status: rawStatus },
    };
  }

  const credentials = extractCredentials(json);

  if (credentials.length === 0) {
    return {
      status: "UNKNOWN",
      errorCode: "SUPPLIER_MISSING_CREDENTIALS",
      message: message ?? "Nhà cung cấp không trả về tài khoản đã giao",
      raw: { shape: describeShape(json), hasOrderId: true },
    };
  }

  // Short delivery is still a SUCCESS: the order service compares the delivered
  // count against the requested quantity and decides on partial fulfilment.
  return {
    status: "SUCCESS",
    supplierOrderId,
    credentials,
    message: message ?? undefined,
    raw: {
      status: rawStatus,
      delivered: credentials.length,
      expected: expectedQuantity,
    },
  };
}