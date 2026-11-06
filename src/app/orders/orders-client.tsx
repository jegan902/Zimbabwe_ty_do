"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { ShoppingBag, Eye, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function OrdersListClient() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();
        if (res.ok) {
          setOrders(data.data?.items || []);
        }
      } catch {
        // Ignored
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchOrders();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border p-12 text-center space-y-4 bg-card">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-bold">Vui lòng đăng nhập</h3>
        <p className="text-xs text-muted-foreground">Bạn cần đăng nhập để xem lịch sử đơn hàng của mình.</p>
        <Button asChild>
          <Link href="/login?next=/orders">Đăng nhập ngay</Link>
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center space-y-3 bg-card">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/60 stroke-[1.5]" />
        <h3 className="text-base font-semibold">Chưa có đơn hàng nào</h3>
        <p className="text-xs text-muted-foreground">Bạn chưa thực hiện giao dịch mua tài khoản nào.</p>
        <Button asChild size="sm" className="mt-2">
          <Link href="/products">Mua sản phẩm ngay</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge className="bg-emerald-600 text-[10px]">Thành công</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="text-[10px]">Thất bại</Badge>;
      case "RECONCILIATION":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px]">Chờ đối soát</Badge>;
      case "PROCESSING":
        return <Badge variant="secondary" className="text-[10px]">Đang xử lý</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-4">Mã đơn hàng</th>
              <th className="py-3 px-4">Sản phẩm</th>
              <th className="py-3 px-4">Số lượng</th>
              <th className="py-3 px-4">Tổng tiền</th>
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="py-3 px-4 font-mono font-bold text-foreground">
                  {o.orderCode}
                </td>
                <td className="py-3 px-4 font-medium max-w-xs truncate">
                  {o.product.name}
                </td>
                <td className="py-3 px-4 font-semibold">{o.quantity}</td>
                <td className="py-3 px-4 font-bold text-primary">
                  {Number(o.totalAmount).toLocaleString("vi-VN")}đ
                </td>
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {new Date(o.createdAt).toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-4">{getStatusBadge(o.status)}</td>
                <td className="py-3 px-4 text-right">
                  <Button variant="ghost" size="sm" asChild className="h-7 text-xs font-semibold gap-1">
                    <Link href={`/orders/${o.orderCode}`}>
                      <Eye className="h-3.5 w-3.5" /> Xem
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

