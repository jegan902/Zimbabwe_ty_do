/**
 * Supplier adapter contract.
 *
 * Core business logic only ever talks to this interface. A supplier's raw
 * response shape, auth scheme, pagination and error format stay inside its
 * adapter, so adding a new supplier never requires touching wallet, order or
 * pricing code.
 */

export interface SupplierProfile {
  /** Supplier-side account identifier, if the API exposes one. */
  accountId?: string;
  username?: string;
  email?: string;
  /** Balance reported by the supplier. Undefined when the API cannot report it. */
  balance?: string;
  currency?: string;
  rawStatus?: string;
}

export interface NormalizedProduct {
  supplierProductId: string;
  name: string;
  description: string | null;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** Decimal string, never a float. */
  cost: string;
  /** null means "the supplier does not expose stock". */
  stock: number | null;
  /** Active or not, as reported by the supplier. */
  isActive: boolean;
  rawStatus: string | null;
  raw: unknown;
}

export interface NormalizedCategory {
  id: string;
  name: string;
}

export interface ProductListResult {
  products: NormalizedProduct[];
  categories: NormalizedCategory[];
}

export interface PurchaseRequest {
  supplierProductId: string;
  quantity: number;
  coupon?: string;
  /** Echoed back to the supplier when it supports order lookups. */
  reference?: string;
}

export type PurchaseOutcome =
  | {
      status: "SUCCESS";
      supplierOrderId: string;
      /** One entry per delivered account, in the supplier's own format. */
      credentials: string[];
      message?: string;
      raw: unknown;
    }
  | {
      status: "FAILED";
      errorCode: string;
      message: string;
      /** True when the supplier explicitly rejected the request, so no retry is safe. */
      definitive: boolean;
      raw: unknown;
    }
  | {
      /**
       * The supplier did not give a usable answer (timeout, 5xx, malformed body).
       * The money may or may not have been spent, so the order must be
       * reconciled instead of retried or refunded.
       */
      status: "UNKNOWN";
      errorCode: string;
      message: string;
      raw: unknown;
    };

export interface SupplierOrderStatus {
  supplierOrderId: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN";
  credentials: string[];
  message?: string;
  raw: unknown;
}

export interface AdapterContext {
  supplierId: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface SupplierAdapter {
  readonly key: string;

  /** Verifies credentials and, when supported, reports the supplier balance. */
  getProfile(context: AdapterContext): Promise<SupplierProfile>;

  /** Full product catalogue with categories. */
  getProducts(context: AdapterContext): Promise<ProductListResult>;

  /** Single product lookup used for pre-purchase revalidation. */
  getProduct(context: AdapterContext, supplierProductId: string): Promise<NormalizedProduct>;

  /** Executes a purchase. Must never throw for a supplier-level failure. */
  buyProduct(context: AdapterContext, request: PurchaseRequest): Promise<PurchaseOutcome>;

  /** Looks up an order when the supplier supports it. */
  getOrder?(context: AdapterContext, supplierOrderId: string): Promise<SupplierOrderStatus>;

  /** Reports whether the supplier exposes a balance endpoint. */
  readonly supportsBalance: boolean;
  readonly supportsStock: boolean;
  readonly supportsWebhook: boolean;
}