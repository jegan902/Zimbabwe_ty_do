import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { syncSupplierProducts } from "@/lib/services/supplier.service";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const POST = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;
  const result = await syncSupplierProducts(id, "MANUAL");
  return successResponse(result);
});

