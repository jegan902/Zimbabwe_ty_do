"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface BuyModalProps {
  product: {
    id: string;
    name: string;
    slug: string;
    sellingPrice: string;
    stock: number | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BuyModal({ product, isOpen, onClose }: BuyModalProps) {
  const router = useRouter();
  const { user, wallet, refresh } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [priceChangeWarning, setPriceChangeWarning] = useState<string | null>(null);

  if (!product) return null;

  const unitPrice = priceChangeWarning ? Number(priceChangeWarning) : Number(product.sellingPrice);
  const totalAmount = unitPrice * quantity;
  const availableBalance = wallet ? Number(wallet.availableBalance) : 0;
  const isBalanceEnough = availableBalance >= totalAmount;

  const handleCheckout = async (confirmedPrice?: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để mua hàng");
      router.push(`/login?next=/products/${product.slug}`);
      return;
    }

    if (!isBalanceEnough) {
      toast.error("Số dư ví không đủ, vui lòng nạp thêm tiền");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          confirmedPrice: confirmedPrice || (priceChangeWarning ?? undefined),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.data?.newPrice) {
          setPriceChangeWarning(data.data.newPrice);
          toast.warning("Giá sản phẩm vừa cập nhật, vui lòng xác nhận giá mới!");
          return;
        }
        throw new Error(data.error?.message || "Đặt hàng thất bại");
      }

      toast.success("Thanh toán thành công! Đang chuyển đến đơn hàng...");
      await refresh();
      onClose();
      router.push(`/orders/${data.data.orderCode}`);
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi xử lý đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Xác nhận mua hàng</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sản phẩm sẽ được bàn giao ngay sau khi thanh toán thành công
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 border">
            <h4 className="font-semibold text-sm line-clamp-1">{product.name}</h4>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Đơn giá:</span>
              <span className="font-bold text-sm text-foreground">
                {unitPrice.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          {priceChangeWarning && (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Giá sản phẩm đã thay đổi:</strong> Giá mới là{" "}
                <span className="font-bold">{Number(priceChangeWarning).toLocaleString("vi-VN")}đ</span>. Bạn có đồng ý tiếp tục mua với giá này không?
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Số lượng:</span>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-1 hover:bg-muted font-bold text-sm"
              >
                -
              </button>
              <span className="px-4 py-1 text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                className="px-3 py-1 hover:bg-muted font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tổng thanh toán:</span>
              <span className="text-base font-black text-primary">
                {totalAmount.toLocaleString("vi-VN")}đ
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" /> Số dư ví khả dụng:
              </span>
              <span className={`font-semibold ${isBalanceEnough ? "text-emerald-600" : "text-destructive"}`}>
                {availableBalance.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          {!user ? (
            <div className="rounded-lg bg-muted p-3 text-xs text-center">
              Bạn chưa đăng nhập. Vui lòng đăng nhập để tiến hành mua hàng.
            </div>
          ) : !isBalanceEnough ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
              <span>Số dư không đủ ({Math.abs(availableBalance - totalAmount).toLocaleString("vi-VN")}đ)</span>
              <Link
                href="/wallet"
                className="font-bold underline hover:opacity-80 flex items-center gap-0.5"
              >
                Nạp tiền ngay <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>

          {!user ? (
            <Button onClick={() => router.push(`/login?next=/products/${product.slug}`)}>
              Đăng nhập để mua
            </Button>
          ) : !isBalanceEnough ? (
            <Button variant="default" asChild>
              <Link href="/wallet">Nạp tiền vào ví</Link>
            </Button>
          ) : (
            <Button onClick={() => handleCheckout()} disabled={loading} className="gap-1.5 font-bold">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {priceChangeWarning ? "Đồng ý giá mới & Mua" : "Thanh toán ngay"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

