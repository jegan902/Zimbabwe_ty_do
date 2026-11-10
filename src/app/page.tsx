import Link from "next/link";
import { getCategories, getProducts } from "@/lib/services/catalog.service";
import { ProductGrid } from "@/components/portal/product-grid";
import { CatalogRealtime } from "@/components/portal/catalog-realtime";
import { Zap, ShieldCheck, CreditCard, ChevronRight, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, productsData] = await Promise.all([
    getCategories(),
    getProducts({ limit: 12, sortBy: "newest" }),
  ]);

  return (
    <div className="flex flex-col gap-12 pb-16">
      <CatalogRealtime />
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background border-b pt-12 pb-16">
        <div className="container mx-auto px-4 sm:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Nền tảng phân phối tài khoản số tự động đa nhà cung cấp
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
              Mua Tài Khoản Số Uy Tín, <span className="text-primary">Giao Dịch Tự Động 24/7</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Hệ thống trung gian kết nối trực tiếp với nhiều nhà cung cấp hàng đầu. Tự động kiểm tra giá nhập, trừ tiền ví thông minh và trả thông tin tài khoản ngay lập tức.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild className="font-bold shadow-md">
                <Link href="/products">
                  Khám phá sản phẩm <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="font-medium">
                <Link href="/wallet">Nạp tiền VietQR</Link>
              </Button>
            </div>
          </div>

          {/* Quick Features */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm">Bàn giao tức thì</h4>
                <p className="text-[11px] text-muted-foreground">Có tài khoản ngay sau khi bấm thanh toán</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm">Nạp ví VietQR tiện lợi</h4>
                <p className="text-[11px] text-muted-foreground">Quét mã QR tự động cộng tiền sau 5 giây</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm">Bảo mật mã hóa</h4>
                <p className="text-[11px] text-muted-foreground">Mã hóa AES-256 dữ liệu nhạy cảm</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      {categories.length > 0 && (
        <section className="container mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Danh mục sản phẩm
            </h2>
            <Link href="/products" className="text-xs font-semibold text-primary hover:underline flex items-center">
              Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?categoryId=${c.id}`}
                className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all shadow-sm shrink-0"
              >
                <span>{c.name}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {c._count.products}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Products */}
      <section className="container mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">Sản phẩm mới cập nhật</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Giá bán tự động cập nhật liên tục từ nhà cung cấp</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/products">Xem tất cả</Link>
          </Button>
        </div>

        <ProductGrid initialProducts={productsData.items as any} />
      </section>
    </div>
  );
}
