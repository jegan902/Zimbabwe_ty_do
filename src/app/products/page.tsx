import { getCategories, getProducts } from "@/lib/services/catalog.service";
import { ProductGrid } from "@/components/portal/product-grid";
import Link from "next/link";
import { Search, Filter } from "lucide-react";
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

      {/* Category Pills & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/products${search ? `?search=${encodeURIComponent(search)}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              !categoryId
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border bg-card hover:bg-muted text-muted-foreground"
            }`}
          >
            Tất cả
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?categoryId=${c.id}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                categoryId === c.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-card hover:bg-muted text-muted-foreground"
              }`}
            >
              {c.name} ({c._count.products})
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Sắp xếp:</span>
          <Link
            href={`/products?${new URLSearchParams({
              ...(categoryId ? { categoryId } : {}),
              ...(search ? { search } : {}),
              sortBy: "newest",
            }).toString()}`}
            className={`px-2.5 py-1 rounded border text-xs font-medium ${
              sortBy === "newest" ? "bg-muted font-bold" : "hover:bg-muted/50"
            }`}
          >
            Mới nhất
          </Link>
          <Link
            href={`/products?${new URLSearchParams({
              ...(categoryId ? { categoryId } : {}),
              ...(search ? { search } : {}),
              sortBy: "price_asc",
            }).toString()}`}
            className={`px-2.5 py-1 rounded border text-xs font-medium ${
              sortBy === "price_asc" ? "bg-muted font-bold" : "hover:bg-muted/50"
            }`}
          >
            Giá thấp
          </Link>
          <Link
            href={`/products?${new URLSearchParams({
              ...(categoryId ? { categoryId } : {}),
              ...(search ? { search } : {}),
              sortBy: "price_desc",
            }).toString()}`}
            className={`px-2.5 py-1 rounded border text-xs font-medium ${
              sortBy === "price_desc" ? "bg-muted font-bold" : "hover:bg-muted/50"
            }`}
          >
            Giá cao
          </Link>
        </div>
      </div>

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

