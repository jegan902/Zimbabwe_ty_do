import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { testSupplierConnection } from "@/lib/services/supplier.service";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const POST = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;
  const result = await testSupplierConnection(id);
  return successResponse(result);
});

