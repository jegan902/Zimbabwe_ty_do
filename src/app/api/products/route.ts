import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/utils/route";
import { successResponse } from "@/lib/utils/response";
import { getProducts } from "@/lib/services/catalog.service";

export const GET = apiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 12;
  const categoryId = searchParams.get("categoryId") || undefined;
  const search = searchParams.get("search") || undefined;
  const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined;
  const sortBy = (searchParams.get("sortBy") as "price_asc" | "price_desc" | "newest" | "name") || undefined;

  const result = await getProducts({
    page,
    limit,
    categoryId,
    search,
    minPrice,
    maxPrice,
    sortBy,
    status: "ACTIVE",
    includeHidden: false,
  });

  return successResponse(result);
});

