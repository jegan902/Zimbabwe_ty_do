import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import {
  DEFAULT_SYNC_INTERVAL,
  normalizeSyncInterval,
} from "@/lib/jobs/sync-settings";

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

  // Fields the caller omits keep their stored value instead of snapping back to
  // the default: toggling auto-sync alone must not reset a 15-minute schedule.
  const existing = await prisma.supplierSyncSettings.findUnique({
    where: { supplierId: id },
  });

  const interval =
    syncInterval !== undefined
      ? normalizeSyncInterval(syncInterval)
      : (existing?.syncInterval ?? DEFAULT_SYNC_INTERVAL);
  const autoSync =
    isAutoSyncEnabled !== undefined
      ? Boolean(isAutoSyncEnabled)
      : (existing?.isAutoSyncEnabled ?? true);

  // Only restart the countdown when something actually changed. Pressing "Lưu"
  // twice would otherwise keep pushing the next run forward, which makes a
  // 5-minute schedule look like it never fires.
  const intervalChanged = interval !== existing?.syncInterval;
  const autoSyncChanged = autoSync !== existing?.isAutoSyncEnabled;

  let nextSyncAt: Date | null = null;
  if (autoSync) {
    const keepSchedule =
      !!existing && !intervalChanged && !autoSyncChanged && !!existing.nextSyncAt;
    nextSyncAt = keepSchedule
      ? existing.nextSyncAt
      : new Date(Date.now() + interval * 1000);
  }

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
