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
import { classifyPurchaseResponse } from "../purchase-result";
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
 * Tạp Hóa MMO / Standard REST API adapter.
 *
 * Designed for modern JSON REST platforms in the digital account ecosystem.
 * Endpoints:
 *   GET  /user/balance   (or /profile) -> { success: true, data: { username, balance, currency } }
 *   GET  /products       -> { success: true, data: [ { id, name, price, stock, category, description, image } ] }
 *   GET  /products/:id   -> { success: true, data: { id, name, price, stock, ... } }
 *   POST /orders         -> { success: true, order_id, credentials: ["user|pass"] }
 *   GET  /orders/:id     -> { success: true, status: "SUCCESS", credentials: [...] }
 */

const TIMEOUT_DEFAULT = 30_000;
const MAX_TIMEOUT = 120_000;

const PRODUCT_LIST_CANDIDATES = ["data", "products", "items", "rows", "list", "result"] as const;
const CREDENTIALS_CANDIDATES = ["data", "credentials", "accounts", "items", "cards"] as const;

function clampTimeout(timeoutMs?: number): number {
  if (!timeoutMs || timeoutMs < 1000) return TIMEOUT_DEFAULT;
  return Math.min(timeoutMs, MAX_TIMEOUT);
}

function normalizeUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${base}/${p}`;
}

export class TapHoaMmoAdapter implements SupplierAdapter {
  readonly key = "taphoammo";
  readonly supportsBalance = true;
  readonly supportsStock = true;
  readonly supportsWebhook = false;

  private context(input: AdapterContext): AdapterContext {
    return { ...input, timeoutMs: clampTimeout(input.timeoutMs) };
  }

  private authHeaders(apiKey: string): Record<string, string> {
    return {
      "Authorization": `Bearer ${apiKey}`,
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  async getProfile(input: AdapterContext): Promise<SupplierProfile> {
    const context = this.context(input);
    const url = `${normalizeUrl(context.baseUrl, "user/balance")}?api_key=${encodeURIComponent(context.apiKey)}`;

    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url,
      timeoutMs: context.timeoutMs,
      headers: this.authHeaders(context.apiKey),
      retryable: true,
      redact: [context.apiKey],
    });

    if (!response.ok) {
      throw new Error(`Supplier returned HTTP ${response.status}: ${response.text.slice(0, 200)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new UnverifiedShapeError("Profile response is not valid JSON", describeShape(response.text));
    }

    const root = asRecord(parsed);
    const data = asRecord(root?.data) ?? root;

    const username = pickString(data, ["username", "name", "email", "user"]) ?? undefined;
    const accountId = pickString(data, ["id", "user_id", "accountId", "account_id"]) ?? undefined;
    const balance = parseAmount(getField(data, ["balance", "money", "sodu", "amount", "cash"])) ?? undefined;
    const currency = pickString(data, ["currency", "donvi"]) ?? "VND";

    return {
      accountId,
      username,
      balance,
      currency,
      rawStatus: response.status.toString(),
    };
  }

  async getProducts(input: AdapterContext): Promise<ProductListResult> {
    const context = this.context(input);
    const url = `${normalizeUrl(context.baseUrl, "products")}?api_key=${encodeURIComponent(context.apiKey)}`;

    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url,
      timeoutMs: context.timeoutMs,
      headers: this.authHeaders(context.apiKey),
      retryable: true,
      redact: [context.apiKey],
    });

    if (!response.ok) {
      throw new Error(`Supplier returned HTTP ${response.status}: ${response.text.slice(0, 200)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new UnverifiedShapeError("Products response is not valid JSON", describeShape(response.text));
    }

    const items = findArray(parsed, PRODUCT_LIST_CANDIDATES);
    if (!items) {
      throw new UnverifiedShapeError("Cannot find products array in supplier payload", describeShape(parsed));
    }

    const categoriesMap = new Map<string, NormalizedCategory>();
    const products: NormalizedProduct[] = [];

    for (const rawItem of items) {
      const rec = asRecord(rawItem);
      if (!rec) continue;

      const id = pickString(rec, ["id", "product_id", "productId", "sku", "code"]);
      const name = pickString(rec, ["name", "title", "product_name", "productName"]);
      const costStr = parseAmount(getField(rec, ["price", "cost", "price_sale", "sale_price", "gia", "unit_price"]));

      if (!id || !name || !costStr) continue;

      const catName = pickString(rec, ["category", "category_name", "categoryName", "group_name", "group"]);
      const catId = pickString(rec, ["category_id", "categoryId", "group_id"]) || (catName ? `cat-${catName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : null);

      if (catId && catName && !categoriesMap.has(catId)) {
        categoriesMap.set(catId, { id: catId, name: catName });
      }

      const stockNum = pickNumber(rec, ["stock", "quantity", "amount", "soluong", "qty"]);
      const explicitActive = pickBoolean(rec, ["is_active", "isActive", "active", "enable", "status"]);
      const rawStatus = pickString(rec, ["status", "state"]) ?? "ACTIVE";

      const isActive = explicitActive !== null ? explicitActive : rawStatus.toUpperCase() === "ACTIVE" || rawStatus === "1";

      products.push({
        supplierProductId: id,
        name,
        description: pickString(rec, ["description", "desc", "detail", "details", "content", "note"]),
        image: pickString(rec, ["image", "image_url", "imageUrl", "thumbnail", "thumb", "avatar"]),
        categoryId: catId,
        categoryName: catName,
        cost: costStr,
        stock: stockNum !== null && stockNum >= 0 ? Math.floor(stockNum) : null,
        isActive,
        rawStatus,
        raw: rawItem,
      });
    }

    return {
      products,
      categories: Array.from(categoriesMap.values()),
    };
  }

  async getProduct(input: AdapterContext, supplierProductId: string): Promise<NormalizedProduct> {
    const context = this.context(input);
    const url = `${normalizeUrl(context.baseUrl, `products/${encodeURIComponent(supplierProductId)}`)}?api_key=${encodeURIComponent(context.apiKey)}`;

    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url,
      timeoutMs: context.timeoutMs,
      headers: this.authHeaders(context.apiKey),
      retryable: true,
      redact: [context.apiKey],
    });

    if (!response.ok) {
      throw new Error(`Supplier returned HTTP ${response.status}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new UnverifiedShapeError("Product single response is not valid JSON", describeShape(response.text));
    }

    const rec = asRecord(asRecord(parsed)?.data) ?? asRecord(parsed);
    if (!rec) {
      throw new UnverifiedShapeError("Product payload is not a JSON object", describeShape(parsed));
    }

    const id = pickString(rec, ["id", "product_id", "productId", "sku"]) || supplierProductId;
    const name = pickString(rec, ["name", "title", "product_name"]) || `SKU ${id}`;
    const cost = parseAmount(getField(rec, ["price", "cost", "sale_price"])) || "0";
    const stock = pickNumber(rec, ["stock", "quantity", "amount"]);

    return {
      supplierProductId: id,
      name,
      description: pickString(rec, ["description", "desc", "detail"]),
      image: pickString(rec, ["image", "imageUrl", "thumbnail"]),
      categoryId: pickString(rec, ["category_id", "categoryId"]),
      categoryName: pickString(rec, ["category", "category_name"]),
      cost,
      stock: stock !== null && stock >= 0 ? Math.floor(stock) : null,
      isActive: true,
      rawStatus: "ACTIVE",
      raw: rec,
    };
  }

  async buyProduct(input: AdapterContext, request: PurchaseRequest): Promise<PurchaseOutcome> {
    const context = this.context(input);
    const url = normalizeUrl(context.baseUrl, "orders");

    const payload = JSON.stringify({
      product_id: request.supplierProductId,
      quantity: request.quantity,
      coupon: request.coupon,
      reference: request.reference,
      api_key: context.apiKey,
    });

    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "POST",
      url,
      timeoutMs: context.timeoutMs,
      headers: this.authHeaders(context.apiKey),
      body: payload,
      retryable: false,
      redact: [context.apiKey],
    });

    return classifyPurchaseResponse(response.status, response.text, request.quantity);
  }

  async getOrder(input: AdapterContext, supplierOrderId: string): Promise<SupplierOrderStatus> {
    const context = this.context(input);
    const url = `${normalizeUrl(context.baseUrl, `orders/${encodeURIComponent(supplierOrderId)}`)}?api_key=${encodeURIComponent(context.apiKey)}`;

    const response = await supplierRequest({
      supplierId: context.supplierId,
      method: "GET",
      url,
      timeoutMs: context.timeoutMs,
      headers: this.authHeaders(context.apiKey),
      retryable: true,
      redact: [context.apiKey],
    });

    if (!response.ok) {
      return {
        supplierOrderId,
        status: "UNKNOWN",
        credentials: [],
        message: `HTTP ${response.status}`,
        raw: response.text,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return {
        supplierOrderId,
        status: "UNKNOWN",
        credentials: [],
        raw: response.text,
      };
    }

    const rec = asRecord(asRecord(parsed)?.data) ?? asRecord(parsed);
    const rawStatus = pickString(rec, ["status", "state"])?.toUpperCase() ?? "PENDING";
    const credentials = (findArray(rec, CREDENTIALS_CANDIDATES) ?? [])
      .map(String)
      .filter(Boolean);

    let status: "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN" = "PENDING";
    if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "1") {
      status = "SUCCESS";
    } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED" || rawStatus === "0") {
      status = "FAILED";
    }

    return {
      supplierOrderId,
      status,
      credentials,
      message: pickString(rec, ["msg", "message"]) ?? undefined,
      raw: parsed,
    };
  }
}

export const tapHoaMmoAdapter = new TapHoaMmoAdapter();
