"use client";

import { useState } from "react";
import { BuyModal } from "@/components/portal/buy-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, ShieldCheck, ShoppingCart, RefreshCw, Clock, Package, ShoppingBag } from "lucide-react";

export function ProductDetailClient({ product }: { product: any }) {
  const [modalOpen, setModalOpen] = useState(false);
  const price = Number(product.sellingPrice);
  const stockLabel =
    product.stock === null || product.stock === undefined
      ? "Liên hệ"
      : Number(product.stock).toLocaleString("vi-VN");
  const soldLabel = Number(product.soldCount ?? 0).toLocaleString("vi-VN");

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Product Image / Mockup */}
        <div className="rounded-2xl border bg-card p-6 flex items-center justify-center min-h-[320px] relative overflow-hidden shadow-sm">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-[300px] w-auto object-contain rounded-xl"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-primary/10 text-primary font-black text-4xl">
              {product.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          {product.category && (
            <Badge variant="secondary" className="absolute top-4 left-4">
              {product.category.name}
            </Badge>
          )}
        </div>

        {/* Right: Info & Actions */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={product.isAvailable ? "default" : "destructive"}>
                {product.isAvailable ? "Sẵn hàng" : "Tạm hết hàng"}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Giao hàng tự động tức thì
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">{product.name}</h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-3">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Còn lại
              </span>
              <div className="mt-1 text-lg font-black text-foreground">{stockLabel}</div>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShoppingBag className="h-3.5 w-3.5" /> Đã bán
              </span>
              <div className="mt-1 text-lg font-black text-foreground">{soldLabel}</div>
            </div>
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <span className="text-xs text-muted-foreground font-medium block">Giá bán công khai</span>
            <div className="text-3xl font-black text-primary mt-1">
              {price.toLocaleString("vi-VN")}đ
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Đã bao gồm thuế và phí bảo hành hệ thống
            </span>
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              onClick={() => setModalOpen(true)}
              disabled={!product.isAvailable}
              className="w-full text-base font-bold shadow-md h-12 gap-2"
            >
              <ShoppingCart className="h-5 w-5" /> Mua ngay
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              Số dư sẽ được trừ trực tiếp từ ví cá nhân của bạn
            </div>
          </div>

          <div className="border-t pt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Nhận tài khoản dạng (username | password) ngay sau thanh toán
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Bảo mật thông tin đăng nhập bằng chuẩn AES-256
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-500" /> Tự động đối soát và hoàn tiền nếu nhà cung cấp xảy ra lỗi
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mt-12 rounded-2xl border bg-card p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold">Mô tả chi tiết sản phẩm</h2>
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {product.description || "Tài khoản số bàn giao tự động, chất lượng cao, kích hoạt sẵn."}
        </div>
      </div>

      <BuyModal
        product={product}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

