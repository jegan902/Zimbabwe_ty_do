import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { listUserOrders } from "@/lib/services/order.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const GET = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

  const result = await listUserOrders(user.id, page, limit);
  return successResponse(result);
});

