import type { Supplier } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { decryptSecret } from "./http";
import { SupplierUnavailableError } from "@/lib/utils/errors";
import type { AdapterContext, SupplierAdapter } from "./supplier.interface";
import { quangVinhAdapter } from "./adapters/quangvinh.adapter";

/**
 * Adapter registry.
 *
 * The database stores only an `adapterKey`; code is resolved here. Adding a
 * supplier means adding one adapter file and registering it — no changes to
 * wallet, order, pricing or UI code.
 */

const ADAPTERS: Record<string, SupplierAdapter> = {
  [quangVinhAdapter.key]: quangVinhAdapter,
};

export function listAdapterKeys(): string[] {
  return Object.keys(ADAPTERS);
}

export function getAdapter(adapterKey: string): SupplierAdapter {
  const adapter = ADAPTERS[adapterKey];
  if (!adapter) {
    throw new SupplierUnavailableError(
      `Chưa có adapter cho nhà cung cấp "${adapterKey}". Các adapter khả dụng: ${listAdapterKeys().join(", ")}`
    );
  }
  return adapter;
}

export function hasAdapter(adapterKey: string): boolean {
  return adapterKey in ADAPTERS;
}

/**
 * Builds the runtime context for a supplier row.
 *
 * The API key is decrypted here and lives only in memory for the duration of the
 * call. It is never serialised into a response, never written to a log, and
 * never included in `SupplierApiLog`.
 */
export function buildContext(supplier: Pick<Supplier, "id" | "baseUrl" | "apiKey" | "timeoutMs">): AdapterContext {
  const apiKey = decryptSecret(supplier.apiKey);
  if (!apiKey) {
    throw new SupplierUnavailableError(
      "Nhà cung cấp chưa được cấu hình API key hoặc khóa không giải mã được"
    );
  }
  return {
    supplierId: supplier.id,
    baseUrl: supplier.baseUrl,
    apiKey,
    timeoutMs: supplier.timeoutMs,
  };
}

export interface ResolvedSupplier {
  supplier: Supplier;
  adapter: SupplierAdapter;
  context: AdapterContext;
}

export async function resolveSupplier(supplierId: string): Promise<ResolvedSupplier> {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new SupplierUnavailableError("Không tìm thấy nhà cung cấp");
  return {
    supplier,
    adapter: getAdapter(supplier.adapterKey),
    context: buildContext(supplier),
  };
}

/** Only suppliers in ACTIVE status may be used for new purchases or syncs. */
export async function listActiveSuppliers(): Promise<Supplier[]> {
  return prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    orderBy: { priority: "asc" },
  });
}

/** Client-safe projection. Never includes apiKey, and never the encrypted blob. */
export interface SupplierPublicView {
  id: string;
  name: string;
  adapterKey: string;
  status: string;
  isPublic: boolean;
  connectionStatus: string;
  supportsBalanceApi: boolean;
  supportsStock: boolean;
  supportsWebhook: boolean;
  lastSyncAt: Date | null;
  lastCheckedAt: Date | null;
}

export function toPublicSupplier(supplier: Supplier): SupplierPublicView {
  return {
    id: supplier.id,
    name: supplier.name,
    adapterKey: supplier.adapterKey,
    status: supplier.status,
    isPublic: supplier.isPublic,
    connectionStatus: supplier.connectionStatus,
    supportsBalanceApi: supplier.supportsBalanceApi,
    supportsStock: supplier.supportsStock,
    supportsWebhook: supplier.supportsWebhook,
    lastSyncAt: supplier.lastSyncAt,
    lastCheckedAt: supplier.lastCheckedAt,
  };
}