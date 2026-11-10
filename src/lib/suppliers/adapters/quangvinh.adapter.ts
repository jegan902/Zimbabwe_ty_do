import type {
  AdapterContext,
  NormalizedCategory,
  NormalizedProduct,
  ProductListResult,
  PurchaseOutcome,
  PurchaseRequest,
  SupplierAdapter,
  SupplierOrderStatus,
  SupplierProfile,
} from "../supplier.interface";
import { supplierRequest } from "../http";
import { classifyPurchaseResponse, looksLikeHtml } from "../purchase-result";
import {
  UnverifiedShapeError,
  asRecord,
  describeShape,
  findArray,
  getField,
  parseAmount,
  pickBoolean,
  pickNumber,
  pickString,
} from "../parse";

/**
 * Quang Vinh Media adapter.
 *
 * Documented endpoints:
 *   GET  /profile.php?api_key=KEY
 *   GET  /products.php?api_key=KEY          (categories + products)
 *   GET  /product.php?api_key=KEY&product=ID
 *   GET  /order.php?api_key=KEY&order=ORDER_ID
 *   POST /buy_product  multipart form-data:
 *        action=buyProduct, id, amount, coupon?, api_key
 *
 * Verified buy success shape (operator sample):
 *   { status: "success", msg, trans_id, data: ["user|pass", ...] }
 *
 * Parsers still tolerate alternate field spellings and fail with an explicit
 * "unverified shape" error instead of inventing data.
 *   - webhooks are NOT assumed
 *
 * Credentials are only ever read from the Context passed by the registry
 * (server-side). They are never logged and never returned to a client.
 */

const TIMEOUT_DEFAULT = 30_000;
const MAX_TIMEOUT = 120_000;

const PRODUCT_ID_FIELDS = [
  "id",
  "product_id",
  "productId",
  "product",
  "code",
  "sku",
] as const;
const PRODUCT_NAME_FIELDS = ["name", "title", "product_name", "productName"] as const;
const PRODUCT_DESC_FIELDS = [
  "description",
  "desc",
  "content",
  "detail",
  "details",
  "note",
] as const;
const PRODUCT_IMAGE_FIELDS = [
  "image",
  "image_url",
  "imageUrl",
  "thumbnail",
  "thumb",
  "avatar",
  "photo",
  "picture",
] as const;
const PRODUCT_PRICE_FIELDS = [
  "price",
  "cost",
  "price_sale",
  "sale_price",
  "priceSale",
  "giaban",
  "gia",
  "unit_price",
] as const;
const PRODUCT_STOCK_FIELDS = [
  "amount",
  "stock",
  "quantity",
  "amount_available",
  "available",
  "tonkho",
  "soluong",
  "qty",
] as const;
const PRODUCT_STATUS_FIELDS = [
  "status",
  "state",
  "active",
  "is_active",
  "isActive",
  "enabled",
  "trangthai",
] as const;
const CATEGORY_ID_FIELDS = [
  "category_id",
  "categoryId",
  "category",
  "cat_id",
  "catId",
  "group_id",
  "groupId",
] as const;
const CATEGORY_NAME_FIELDS = [
  "category_name",
  "categoryName",
  "category",
  "cat_name",
  "catName",
  "group_name",
  "groupName",
] as const;

function clampTimeout(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return TIMEOUT_DEFAULT;
  return Math.min(Math.max(value, 5_000), MAX_TIMEOUT);
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string>): string {
  const base = baseUrl.replace(/\/+$/, "");
  // The documented endpoints are .php files. Keeping the join explicit avoids
  // the `/api` + `/profile.php` double-slash class of bug.
  const url = new URL(`${base}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Extracts JSON, falling back to the raw text so a diagnostic can describe the
 * shape. HTML error pages are never silently treated as success.
 */
function decodePayload(text: string): { json: unknown; isJson: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { json: null, isJson: false };
  try {
    return { json: JSON.parse(trimmed), isJson: true };
  } catch {
    return { json: null, isJson: false };
  }
}

function detectActiveStatus(raw: unknown, fallbackText: string | null): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (["active", "1", "true", "on", "enabled", "available", "instock", "in_stock"].includes(v)) {
      return true;
    }
    if (
      ["0", "false", "off", "disabled", "inactive", "hidden", "deleted", "outofstock", "out_of_stock"].includes(
        v
      )
    ) {
      return false;
    }
  }
  if (fallbackText) {
    const v = fallbackText.trim().toLowerCase();
    if (["inactive", "disabled", "hidden", "deleted", "stopped", "ngung"].includes(v)) return false;
  }
  // Unknown status is treated as active only because the listing endpoint is
  // assumed to return sellable products. Availability is enforced again by the
  // pre-purchase revalidation, which re-reads the product from the supplier.
  return true;
}

function mapCategory(raw: unknown, index: number): NormalizedCategory | null {
  const record = asRecord(raw);
  if (!record) {
    if (typeof raw === "string" && raw.trim()) {
      return { id: raw.trim(), name: raw.trim() };
    }
    return null;
  }
  const id =
    pickString(record, CATEGORY_ID_FIELDS) ?? pickString(record, ["id"]) ?? `cat-${index}`;
  const name =
    pickString(record, CATEGORY_NAME_FIELDS) ?? pickString(record, ["name", "title"]) ?? id;
  return { id: String(id), name };
}

function mapProduct(
  raw: unknown,
  fallbackCategory: { id: string; name: string } | null,
  supplierLabel: string
): NormalizedProduct | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = pickString(record, PRODUCT_ID_FIELDS);
  if (!id) return null;

  const name =
    pickString(record, PRODUCT_NAME_FIELDS) ?? `${supplierLabel} ${id}`;

  const costRaw = pickString(record, PRODUCT_PRICE_FIELDS);
  const cost = parseAmount(costRaw ?? getField(record, PRODUCT_PRICE_FIELDS));

  // A product with no readable price cannot be sold. Surfacing it as a skip keeps
  // the sync accurate instead of storing a zero cost that would look profitable.
  if (cost === null) return null;

  const stockValue = pickNumber(record, PRODUCT_STOCK_FIELDS);
  const rawStatus = pickString(record, PRODUCT_STATUS_FIELDS);
  const explicitActive = pickBoolean(record, PRODUCT_STATUS_FIELDS);

  const inlineCategoryId = pickString(record, CATEGORY_ID_FIELDS);
  const inlineCategoryName = pickString(record, CATEGORY_NAME_FIELDS);

  const category = inlineCategoryId
    ? { id: inlineCategoryId, name: inlineCategoryName ?? inlineCategoryId }
    : fallbackCategory;

  return {
    supplierProductId: id,
    name,
    description: pickString(record, PRODUCT_DESC_FIELDS),
    image: pickString(record, PRODUCT_IMAGE_FIELDS),
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    cost,
    stock: stockValue !== null && stockValue >= 0 ? Math.floor(stockValue) : null,
    isActive:
      explicitActive !== null ? explicitActive : detectActiveStatus(rawStatus, rawStatus),
    rawStatus,
    raw,
  };
}

export class QuangVinhAdapter implements SupplierAdapter {
  readonly key = "quangvinh";

  readonly supportsBalance = true;
  readonly supportsStock = true;
  readonly supportsWebhook = false;

  private context(input: AdapterContext): AdapterContext {
    return { ...input, timeoutMs: clampTimeout(input.timeoutMs) };
  }

  async getProfile(input: AdapterContext): Promise<SupplierProfile> {
    const context = this.context(input);
    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url: buildUrl(context.baseUrl, "profile.php", { api_key: context.apiKey }),
      timeoutMs: context.timeoutMs,
      retryable: true,
      redact: [context.apiKey],
    });

    this.assertHttpGetSuccess(response, "profile.php");

    const { json, isJson } = decodePayload(response.text);
    if (!isJson) {
      throw new UnverifiedShapeError(
        "profile.php did not return JSON",
        `text(${response.text.length} chars)`
      );
    }

    const root = asRecord(json);
    const dataObj = asRecord(getField(root, ["data"])) ?? root;
    if (!dataObj) {
      throw new UnverifiedShapeError(
        "profile.php returned JSON without an object body",
        describeShape(json)
      );
    }

    const balanceRaw = getField(dataObj, [
      "balance",
      "money",
      "wallet",
      "credit",
      "sodu",
      "available_balance",
    ]);

    const balance = parseAmount(balanceRaw);

    return {
      accountId: pickString(dataObj, ["id", "user_id", "userId", "account_id"]) ?? undefined,
      username: pickString(dataObj, ["username", "user", "name"]) ?? undefined,
      email: pickString(dataObj, ["email"]) ?? undefined,
      balance: balance ?? undefined,
      currency: "VND",
      rawStatus: pickString(dataObj, ["status", "active", "state"]) ?? undefined,
    };
  }

  async getProducts(input: AdapterContext): Promise<ProductListResult> {
    const context = this.context(input);
    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url: buildUrl(context.baseUrl, "products.php", { api_key: context.apiKey }),
      timeoutMs: context.timeoutMs,
      retryable: true,
      redact: [context.apiKey],
    });

    this.assertHttpGetSuccess(response, "products.php");

    const { json, isJson } = decodePayload(response.text);
    if (!isJson) {
      throw new UnverifiedShapeError(
        "products.php did not return JSON",
        looksLikeHtml(response.text)
          ? "html-error-page"
          : `text(${response.text.length} chars)`
      );
    }

    // Categories are only parsed when the payload clearly contains them.
    const categoryRaw = findArray(json, ["categories", "category", "groups", "danhmuc"]);
    const categories: NormalizedCategory[] = [];
    const categoryMap = new Map<string, NormalizedCategory>();

    if (categoryRaw) {
      for (const [index, item] of categoryRaw.entries()) {
        const mapped = mapCategory(item, index);
        if (!mapped) continue;
        categories.push(mapped);
        categoryMap.set(mapped.id, mapped);
      }
    }

    // Products may be a flat array, or nested inside a category object.
    const entries = this.collectProductEntries(json);

    if (!entries) {
      throw new UnverifiedShapeError(
        "products.php returned JSON but no product array was found",
        describeShape(json)
      );
    }

    const products: NormalizedProduct[] = [];
    const seen = new Set<string>();

    for (const { raw, category } of entries) {
      const mapped = mapProduct(raw, category, "Sản phẩm");
      if (mapped && !seen.has(mapped.supplierProductId)) {
        seen.add(mapped.supplierProductId);
        products.push(mapped);
      }
    }

    return { products, categories: categoryMap.size > 0 ? categories : [] };
  }

  /**
   * Normalises both payload shapes into `{ raw, category }` entries so the
   * parent category survives flattening:
   *   - `{ products: [...] }`                       flat list, no category
   *   - `{ categories: [{ id, name, products }] }`  nested, category is the parent
   */
  private collectProductEntries(
    json: unknown
  ): Array<{ raw: unknown; category: { id: string; name: string } | null }> | null {
    const entries: Array<{ raw: unknown; category: { id: string; name: string } | null }> = [];

    const flatRaw = findArray(json, ["products", "product", "items", "data", "sanpham"]);
    if (flatRaw) {
      for (const [index, item] of flatRaw.entries()) {
        const record = asRecord(item);
        // A category-shaped item also carries an `id`, so treat it as a parent
        // when it clearly contains a nested product list.
        if (record && findArray(record, ["products", "items", "product"])) {
          const parent = mapCategory(item, index);
          const fallback = parent ? { id: parent.id, name: parent.name } : null;
          const nested = findArray(record, ["products", "items", "product"]) ?? [];
          for (const child of nested) entries.push({ raw: child, category: fallback });
          continue;
        }
        entries.push({ raw: item, category: null });
      }
      return entries.length > 0 ? entries : null;
    }

    const categoryRaw = findArray(json, ["categories", "category", "groups", "danhmuc"]);
    if (!categoryRaw) return null;

    for (const [index, item] of categoryRaw.entries()) {
      const record = asRecord(item);
      if (!record) continue;
      const nested = findArray(record, ["products", "items", "product"]);
      if (!nested) continue;
      const parent = mapCategory(item, index);
      const fallback = parent ? { id: parent.id, name: parent.name } : null;
      for (const child of nested) entries.push({ raw: child, category: fallback });
    }

    return entries.length > 0 ? entries : null;
  }

  async getProduct(
    input: AdapterContext,
    supplierProductId: string
  ): Promise<NormalizedProduct> {
    const context = this.context(input);
    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url: buildUrl(context.baseUrl, "product.php", {
        api_key: context.apiKey,
        product: supplierProductId,
      }),
      timeoutMs: context.timeoutMs,
      retryable: true,
      redact: [context.apiKey],
    });

    this.assertHttpGetSuccess(response, "product.php");

    const { json, isJson } = decodePayload(response.text);
    if (!isJson) {
      throw new UnverifiedShapeError(
        "product.php did not return JSON",
        looksLikeHtml(response.text) ? "html-error-page" : `text(${response.text.length} chars)`
      );
    }

    const candidate =
      asRecord(getField(asRecord(json), ["data", "product"])) ?? asRecord(json) ?? json;

    const mapped = mapProduct(candidate, null, "Sản phẩm");
    if (!mapped) {
      throw new UnverifiedShapeError(
        "product.php payload could not be mapped to a product",
        describeShape(json)
      );
    }

    // Trust the path parameter over the body when the body omits the id.
    return { ...mapped, supplierProductId: mapped.supplierProductId || supplierProductId };
  }

  /**
   * Purchase execution.
   *
   * The POST is deliberately never retried: a timeout or dropped connection
   * leaves the transaction in an unknown state, and re-sending could deliver a
   * second order. The caller receives UNKNOWN and must reconcile.
   *
   * This method is only invoked by the order service when the operator has
   * enabled live purchasing for the supplier, because the response contract is
   * unverified.
   */
  async buyProduct(
    input: AdapterContext,
    request: PurchaseRequest
  ): Promise<PurchaseOutcome> {
    const context = this.context(input);

    if (!Number.isInteger(request.quantity) || request.quantity < 1) {
      return {
        status: "FAILED",
        errorCode: "INVALID_QUANTITY",
        message: "Số lượng không hợp lệ",
        definitive: true,
        raw: null,
      };
    }

    const form = new FormData();
    form.set("action", "buyProduct");
    form.set("id", request.supplierProductId);
    form.set("amount", String(request.quantity));
    form.set("api_key", context.apiKey);
    if (request.coupon) form.set("coupon", request.coupon);

    let response;
    try {
      response = await supplierRequest({
        supplierId: context.supplierId,
        method: "POST",
        url: buildUrl(context.baseUrl, "buy_product", {}),
        timeoutMs: context.timeoutMs,
        body: form,
        // Critical: purchase POSTs are never retried.
        retryable: false,
        redact: [context.apiKey],
      });
    } catch (error) {
      // Transport failure: the outcome is genuinely unknown.
      return {
        status: "UNKNOWN",
        errorCode: "SUPPLIER_TRANSPORT_ERROR",
        message: (error as Error).message,
        raw: null,
      };
    }

    return classifyPurchaseResponse(response.status, response.text, request.quantity);
  }

  /**
   * Order lookup, used for reconciliation after an UNKNOWN outcome.
   * The brief listed GET /order.php, but its response was never verified.
   */
  async getOrder(input: AdapterContext, supplierOrderId: string): Promise<SupplierOrderStatus> {
    const context = this.context(input);
    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url: buildUrl(context.baseUrl, "order.php", {
        api_key: context.apiKey,
        order: supplierOrderId,
      }),
      timeoutMs: context.timeoutMs,
      retryable: true,
      redact: [context.apiKey],
    });

    if (response.status === 404) {
      return {
        supplierOrderId,
        status: "FAILED",
        credentials: [],
        message: "Nhà cung cấp không tìm thấy đơn hàng",
        raw: { status: response.status },
      };
    }

    if (!response.ok) {
      return {
        supplierOrderId,
        status: "UNKNOWN",
        credentials: [],
        message: `Nhà cung cấp trả về HTTP ${response.status}`,
        raw: { status: response.status },
      };
    }

    const { json, isJson } = decodePayload(response.text);
    if (!isJson) {
      return {
        supplierOrderId,
        status: "UNKNOWN",
        credentials: [],
        message: "Phản hồi tra cứu đơn hàng không phải JSON",
        raw: { status: response.status },
      };
    }

    const candidate = asRecord(getField(asRecord(json), ["data", "order"])) ?? asRecord(json);
    const rawStatus = (pickString(candidate, [
      "status",
      "state",
      "order_status",
      "orderStatus",
    ]) ?? "").toLowerCase();

    const credentialArray = findArray(json, ["data", "accounts", "items", "products"]);
    const credentials = Array.isArray(credentialArray)
      ? credentialArray
          .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            const entryRecord = asRecord(entry);
            if (!entryRecord) return "";
            return Object.values(entryRecord)
              .filter((v) => typeof v === "string")
              .join("|")
              .trim();
          })
          .filter(Boolean)
      : [];

    let status: SupplierOrderStatus["status"] = "UNKNOWN";
    if (
      ["success", "completed", "done", "completed_order", "paid", "delivered"].includes(rawStatus)
    ) {
      status = "SUCCESS";
    } else if (["failed", "error", "cancelled", "canceled", "rejected", "refunded"].includes(rawStatus)) {
      status = "FAILED";
    } else if (["pending", "processing", "waiting", "new"].includes(rawStatus)) {
      status = "PENDING";
    }

    return {
      supplierOrderId,
      status,
      credentials,
      message: pickString(candidate, ["msg", "message", "note"]) ?? undefined,
      raw: { status: rawStatus || null, shape: describeShape(json) },
    };
  }

  /** Maps non-2xx GET responses to typed, actionable errors. */
  private assertHttpGetSuccess(
    response: { status: number; text: string },
    endpoint: string
  ): void {
    if (response.status >= 200 && response.status < 300) return;

    if (response.status === 401 || response.status === 403) {
      throw new SupplierAuthError(
        `Nhà cung cấp từ chối API key khi gọi ${endpoint} (HTTP ${response.status})`
      );
    }
    if (response.status === 400) {
      throw new SupplierRequestError(
        `Yêu cầu tới ${endpoint} không hợp lệ (HTTP 400)`,
        "SUPPLIER_BAD_REQUEST"
      );
    }
    if (response.status === 404) {
      throw new SupplierRequestError(
        `Không tìm thấy endpoint ${endpoint} (HTTP 404)`,
        "SUPPLIER_ENDPOINT_NOT_FOUND"
      );
    }
    if (response.status === 429) {
      throw new SupplierRequestError(
        `Nhà cung cấp giới hạn tần suất khi gọi ${endpoint} (HTTP 429)`,
        "SUPPLIER_RATE_LIMITED"
      );
    }
    if (response.status >= 500) {
      throw new SupplierRequestError(
        `Nhà cung cấp lỗi máy chủ khi gọi ${endpoint} (HTTP ${response.status})`,
        "SUPPLIER_SERVER_ERROR"
      );
    }
    throw new SupplierRequestError(
      `Phản hồi không mong đợi từ ${endpoint} (HTTP ${response.status})`,
      "SUPPLIER_UNEXPECTED_STATUS"
    );
  }
}

/** Credential problems are separated so the admin UI can prompt for a new key. */
export class SupplierAuthError extends Error {
  readonly code = "SUPPLIER_AUTH_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "SupplierAuthError";
    Object.setPrototypeOf(this, SupplierAuthError.prototype);
  }
}

export class SupplierRequestError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "SupplierRequestError";
    Object.setPrototypeOf(this, SupplierRequestError.prototype);
  }
}

export const quangVinhAdapter = new QuangVinhAdapter();