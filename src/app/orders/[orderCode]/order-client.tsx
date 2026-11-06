"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, AlertCircle, ShoppingBag, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function OrderResultClient({ orderCode }: { orderCode: string }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderCode}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Không thể tải thông tin đơn hàng");
        }
        setOrder(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderCode]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  const copyAll = () => {
    if (!order?.credentials) return;
    const all = order.credentials.map((c: any) => c.raw).join("\n");
    navigator.clipboard.writeText(all);
    toast.success("Đã sao chép tất cả thông tin tài khoản!");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải thông tin đơn hàng...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center space-y-4">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="text-lg font-bold text-destructive">Không tìm thấy đơn hàng</h2>
        <p className="text-xs text-muted-foreground">{error || "Mã đơn hàng không hợp lệ hoặc bạn không có quyền xem đơn hàng này."}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/orders">Về lịch sử đơn hàng</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8 text-center shadow-sm space-y-3">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-1">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black">Đặt hàng thành công!</h1>
        <p className="text-xs text-muted-foreground">
          Đơn hàng <span className="font-bold text-foreground">{order.orderCode}</span> đã được xử lý và bàn giao tức thì.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Badge variant="outline" className="text-xs py-1 px-3">
            Sản phẩm: {order.product.name}
          </Badge>
          <Badge variant="outline" className="text-xs py-1 px-3">
            Số lượng: {order.quantity}
          </Badge>
          <Badge variant="outline" className="text-xs py-1 px-3 font-bold text-primary">
            Tổng tiền: {Number(order.totalAmount).toLocaleString("vi-VN")}đ
          </Badge>
        </div>
      </div>

      {/* Credentials Block */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base">Thông tin tài khoản đã bàn giao</h3>
          </div>
          {order.credentials.length > 1 && (
            <Button size="sm" variant="outline" onClick={copyAll} className="h-8 text-xs gap-1 font-semibold">
              <Copy className="h-3.5 w-3.5" /> Sao chép tất cả
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {order.credentials.map((cred: any, idx: number) => (
            <div
              key={idx}
              className="rounded-xl border bg-muted/40 p-4 space-y-3 font-mono text-xs"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-sans font-semibold text-[11px]">Tài khoản #{cred.position}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyText(cred.raw, `tài khoản #${cred.position}`)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Copy className="h-3 w-3" /> Sao chép dòng này
                </Button>
              </div>

              {cred.username && cred.password ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg bg-background p-2.5 border flex items-center justify-between">
                    <div className="overflow-hidden">
                      <span className="text-[10px] text-muted-foreground font-sans block">Tài khoản</span>
                      <span className="font-bold truncate select-all">{cred.username}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(cred.username, "tài khoản")}
                      className="h-7 w-7 p-0 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="rounded-lg bg-background p-2.5 border flex items-center justify-between">
                    <div className="overflow-hidden">
                      <span className="text-[10px] text-muted-foreground font-sans block">Mật khẩu</span>
                      <span className="font-bold truncate select-all">{cred.password}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(cred.password, "mật khẩu")}
                      className="h-7 w-7 p-0 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-background p-3 border font-semibold select-all break-all">
                  {cred.raw}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" asChild size="sm">
          <Link href="/orders">
            <ShoppingBag className="mr-2 h-4 w-4" /> Xem tất cả đơn hàng
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/products">Tiếp tục mua hàng</Link>
        </Button>
      </div>
    </div>
  );
}

