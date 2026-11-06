"use client";

import { useState } from "react";
import Link from "next/link";
import { BuyModal } from "@/components/portal/buy-modal";
import { ShoppingCart, Eye, Tag, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  sellingPrice: string;
  stock: number | null;
  status: string;
  isFeatured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function ProductGrid({ initialProducts }: { initialProducts: ProductItem[] }) {
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenBuy = (product: ProductItem) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  if (!initialProducts || initialProducts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
        <Tag className="mx-auto h-12 w-12 stroke-[1.5] text-muted-foreground/60 mb-3" />
        <h3 className="text-base font-semibold text-foreground">Chưa có sản phẩm nào</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Hệ thống đang đồng bộ dữ liệu từ các nhà cung cấp. Vui lòng quay lại sau!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {initialProducts.map((p) => {
          const price = Number(p.sellingPrice);
          return (
            <div
              key={p.id}
              className="group relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="aspect-[4/3] w-full bg-muted/60 relative overflow-hidden flex items-center justify-center p-4">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-2xl">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {p.category && (
                  <Badge variant="secondary" className="absolute top-3 left-3 text-[10px] font-medium bg-background/80 backdrop-blur">
                    {p.category.name}
                  </Badge>
                )}
                <Badge
                  variant={p.status === "ACTIVE" ? "default" : "destructive"}
                  className="absolute top-3 right-3 text-[10px]"
                >
                  {p.status === "ACTIVE" ? "Sẵn hàng" : "Hết hàng"}
                </Badge>
              </div>

              <div className="flex flex-col flex-1 p-4">
                <Link href={`/products/${p.slug}`} className="hover:text-primary transition-colors">
                  <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                </Link>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-4 flex-1">
                  {p.description || "Tài khoản số bàn giao tự động chất lượng cao"}
                </p>

                <div className="border-t pt-3 flex items-center justify-between mt-auto">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Giá bán</span>
                    <span className="font-black text-base text-primary">
                      {price.toLocaleString("vi-VN")}đ
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" asChild className="h-8 px-2.5">
                      <Link href={`/products/${p.slug}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenBuy(p)}
                      disabled={p.status !== "ACTIVE"}
                      className="h-8 gap-1 px-3 font-semibold text-xs"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> Mua ngay
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BuyModal
        product={selectedProduct}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

