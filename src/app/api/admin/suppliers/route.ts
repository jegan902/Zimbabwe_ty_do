import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

import { encryptSecret } from "@/lib/suppliers/http";
import { getAdapter, hasAdapter, AVAILABLE_ADAPTERS } from "@/lib/suppliers/registry";
import { ConflictError, ValidationError } from "@/lib/utils/errors";
import { createdResponse } from "@/lib/utils/response";

export const GET = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  const suppliers = await prisma.supplier.findMany({
    orderBy: { priority: "asc" },
    include: {
      balance: true,
      syncSettings: true,
      _count: {
        select: {
          products: true,
          transactions: true,
        },
      },
    },
  });

  const supplierProfiles = await Promise.all(
    suppliers.map(async (s) => {
      // Find latest profile response from API log
      const log = await prisma.supplierApiLog.findFirst({
        where: {
          supplierId: s.id,
          endpoint: { contains: "profile" },
          success: true,
        },
        orderBy: { createdAt: "desc" },
      });

      let accountProfile: {
        username?: string;
        balance?: string;
        currency?: string;
        lastCheckedAt?: Date | null;
      } | null = null;

      if (log?.responseData) {
        try {
          const parsed = JSON.parse(log.responseData);
          const data = parsed.data || parsed;
          accountProfile = {
            username: data.username || data.name || data.user || undefined,
            balance: data.money || data.balance || data.sodu || s.balance?.balance.toString() || "0",
            currency: "VND",
            lastCheckedAt: log.createdAt,
          };
        } catch {
          // Ignored
        }
      }

      return {
        id: s.id,
        name: s.name,
        adapterKey: s.adapterKey,
        baseUrl: s.baseUrl,
        status: s.status,
        connectionStatus: s.connectionStatus,
        connectionError: s.connectionError,
        lastCheckedAt: s.lastCheckedAt,
        lastSyncAt: s.lastSyncAt,
        lastSyncError: s.lastSyncError,
        profitType: s.profitType,
        profitValue: s.profitValue.toString(),
        supportsBalanceApi: s.supportsBalanceApi,
        supportsStock: s.supportsStock,
        supportsWebhook: s.supportsWebhook,
        productCount: s._count.products,
        accountProfile,
        balance: s.balance
          ? {
              balance: s.balance.balance.toString(),
              estimatedBalance: s.balance.estimatedBalance.toString(),
              balanceType: s.balance.balanceType,
              totalTopUps: s.balance.totalTopUps.toString(),
              totalSpent: s.balance.totalSpent.toString(),
              alertThreshold: s.balance.alertThreshold.toString(),
            }
          : null,
        syncSettings: s.syncSettings,
      };
    })
  );

  return successResponse({
    suppliers: supplierProfiles,
    availableAdapters: AVAILABLE_ADAPTERS,
  });
});

export const POST = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const {
    name,
    adapterKey,
    baseUrl,
    apiKey,
    profitType = "PERCENTAGE",
    profitValue = 10,
    alertThreshold = 50000,
    priority = 100,
    timeoutMs = 30000,
  } = (body as {
    name?: string;
    adapterKey?: string;
    baseUrl?: string;
    apiKey?: string;
    profitType?: "PERCENTAGE" | "FIXED";
    profitValue?: number;
    alertThreshold?: number;
    priority?: number;
    timeoutMs?: number;
  }) || {};

  if (!name?.trim()) throw new ValidationError("Tên nhà cung cấp không được để trống");
  if (!adapterKey?.trim()) throw new ValidationError("Vui lòng chọn loại adapter");
  if (!baseUrl?.trim()) throw new ValidationError("Base URL không được để trống");
  if (!apiKey?.trim()) throw new ValidationError("API Key không được để trống");

  if (!hasAdapter(adapterKey.trim())) {
    throw new ValidationError(`Loại adapter "${adapterKey}" không tồn tại trên hệ thống`);
  }

  const existing = await prisma.supplier.findUnique({
    where: { name: name.trim() },
  });
  if (existing) {
    throw new ConflictError(`Nhà cung cấp "${name.trim()}" đã tồn tại`);
  }

  const adapter = getAdapter(adapterKey.trim());

  const newSupplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      adapterKey: adapterKey.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: encryptSecret(apiKey.trim()),
      profitType: profitType === "FIXED" ? "FIXED" : "PERCENTAGE",
      profitValue: Number(profitValue) || 10,
      priority: Number(priority) || 100,
      timeoutMs: Number(timeoutMs) || 30000,
      supportsBalanceApi: adapter.supportsBalance,
      supportsStock: adapter.supportsStock,
      supportsWebhook: adapter.supportsWebhook,
      status: "ACTIVE",
      connectionStatus: "UNKNOWN",
      balance: {
        create: {
          balance: 0,
          alertThreshold: Number(alertThreshold) || 50000,
        },
      },
      syncSettings: {
        create: {
          syncInterval: 300,
          isAutoSyncEnabled: true,
          nextSyncAt: new Date(),
        },
      },
    },
    include: {
      balance: true,
      syncSettings: true,
    },
  });

  return createdResponse(
    {
      id: newSupplier.id,
      name: newSupplier.name,
      adapterKey: newSupplier.adapterKey,
      baseUrl: newSupplier.baseUrl,
      status: newSupplier.status,
    },
    "Thêm nhà cung cấp thành công"
  );
});

