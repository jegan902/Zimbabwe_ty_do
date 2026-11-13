import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { normalizeSyncInterval, scheduleNextSync } from "@/lib/jobs/sync-settings";

export const GET = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const settings = await prisma.supplierSyncSettings.findUnique({
    where: { supplierId: id },
  });

  return successResponse(
    settings || {
      supplierId: id,
      syncInterval: 300,
      isAutoSyncEnabled: true,
      nextSyncAt: null,
    }
  );
});

export const PUT = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const { syncInterval, isAutoSyncEnabled } = (body as {
    syncInterval?: number;
    isAutoSyncEnabled?: boolean;
  }) || {};

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new NotFoundError("Không tìm thấy nhà cung cấp");

  const interval = syncInterval !== undefined ? normalizeSyncInterval(syncInterval) : 300;
  const autoSync = isAutoSyncEnabled !== undefined ? Boolean(isAutoSyncEnabled) : true;
  const nextSyncAt = autoSync ? new Date(Date.now() + interval * 1000) : null;

  const updated = await prisma.supplierSyncSettings.upsert({
    where: { supplierId: id },
    create: {
      supplierId: id,
      syncInterval: interval,
      isAutoSyncEnabled: autoSync,
      nextSyncAt,
    },
    update: {
      syncInterval: interval,
      isAutoSyncEnabled: autoSync,
      nextSyncAt,
    },
  });

  return successResponse(updated, "Cập nhật cài đặt đồng bộ tự động thành công");
});
