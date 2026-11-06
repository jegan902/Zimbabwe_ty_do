import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getOrderDetails } from "@/lib/services/order.service";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";

export const GET = apiRouteWithParams<{ orderCode: string }>(
  async (request: NextRequest, { params }) => {
    const user = await requireApiUser(request);
    const { orderCode } = await params;
    const order = await getOrderDetails(user.id, orderCode, user.role === "ADMIN" || user.role === "SUPERADMIN");
    return successResponse(order);
  }
);

