import { NextRequest } from "next/server";
import { apiRouteWithParams } from "@/lib/utils/route";
import { successResponse } from "@/lib/utils/response";
import { getProductBySlug } from "@/lib/services/catalog.service";

export const GET = apiRouteWithParams<{ slug: string }>(async (_request: NextRequest, { params }) => {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return successResponse(product);
});

