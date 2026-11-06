import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/utils/route";
import { successResponse } from "@/lib/utils/response";
import { getCategories } from "@/lib/services/catalog.service";

export const GET = apiRoute(async () => {
  const categories = await getCategories();
  return successResponse(categories);
});

