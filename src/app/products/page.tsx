import { getCategories, getProducts } from "@/lib/services/catalog.service";
import { ProductGrid } from "@/components/portal/product-grid";
import { CatalogRealtime } from "@/components/portal/catalog-realtime";
import { CategoryFilterBar } from "@/components/portal/category-filter-bar";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const sortBy = typeof params.sortBy === "string" ? (params.sortBy as any) : "newest";

  const [categories, data] = await Promise.all([
    getCategories(),
    getProducts({
      page,
      limit: 16,
      categoryId,
      search,
      sortBy,
      status: "ACTIVE",
    }),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-8 space-y-6">
      <CatalogRealtime />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">Danh sách sản phẩm</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Hiển thị {data.items.length} trên tổng số {data.total} sản phẩm
          </p>
        </div>

        {/* Search bar */}
        <form method="GET" action="/products" className="flex items-center gap-2 max-w-sm w-full">
          {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              defaultValue={search || ""}
              placeholder="Tìm kiếm tài khoản..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="h-9 font-semibold text-xs">
            Tìm
          </Button>
        </form>
      </div>

      {/* Category Pills & Sort Bar with overflow-x-auto, scrollbar-none and 'Xem nhiều hơn' expandable dropdown */}
      <CategoryFilterBar
        categories={categories}
        activeCategoryId={categoryId}
        search={search}
        sortBy={sortBy}
      />

      {/* Grid */}
      <ProductGrid initialProducts={data.items as any} />

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          {Array.from({ length: data.totalPages }).map((_, idx) => {
            const p = idx + 1;
            return (
              <Link
                key={p}
                href={`/products?${new URLSearchParams({
                  ...(categoryId ? { categoryId } : {}),
                  ...(search ? { search } : {}),
                  ...(sortBy ? { sortBy } : {}),
                  page: p.toString(),
                }).toString()}`}
                className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold border transition-colors ${
                  page === p ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

