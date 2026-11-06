import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const GET = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  const logs = await prisma.supplierSyncLog.findMany({
    where: { supplierId: id },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return successResponse(logs);
});

