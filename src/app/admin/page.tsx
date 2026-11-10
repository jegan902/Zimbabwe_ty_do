"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Wallet,
  Users,
  AlertCircle,
  Truck,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncingSupplier, setSyncingSupplier] = useState(false);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch("/api/admin/overview");
        const json = await res.json();
        if (res.ok) {
          setData(json.data);
        }
      } catch {
        // Ignored
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const recentOrders = data?.recentOrders || [];
  const supplierAccount = data?.supplierAccount;

  const handleSyncLiveBalance = async () => {
    if (!supplierAccount?.id) return;
    setSyncingSupplier(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierAccount.id}/test-connection`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Kiểm tra thất bại");
      // Re-fetch overview
      const overviewRes = await fetch("/api/admin/overview");
      const overviewJson = await overviewRes.json();
      if (overviewRes.ok) setData(overviewJson.data);
    } catch {
      // Ignored
    } finally {
      setSyncingSupplier(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-black">Dashboard Tổng Quan</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Theo dõi doanh thu, lợi nhuận, số dư 2 bên và trạng thái vận hành hệ thống.
        </p>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Tổng doanh thu</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {Number(metrics.totalRevenue || 0).toLocaleString("vi-VN")}đ
          </div>
          <p className="text-[11px] text-muted-foreground">Doanh thu đơn hàng thành công</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Lợi nhuận gộp</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-primary">
            {Number(metrics.totalProfit || 0).toLocaleString("vi-VN")}đ
          </div>
          <p className="text-[11px] text-muted-foreground">Chênh lệch giá bán và giá nhập</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Vốn tại nhà cung cấp</span>
            <Truck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {Number(metrics.totalSupplierBalances || 0).toLocaleString("vi-VN")}đ
          </div>
          <p className="text-[11px] text-muted-foreground">Vốn khả dụng nạp trước</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Ví khách hàng</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {Number(metrics.totalCustomerWallet || 0).toLocaleString("vi-VN")}đ
          </div>
          <p className="text-[11px] text-muted-foreground">Tổng nghĩa vụ nợ phải trả khách</p>
        </div>
      </div>

      {/* Intermediary Supplier Account Card */}
      {supplierAccount && (
        <div className="rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base">Tài Khoản Trung Gian Nhà Cung Cấp</h3>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    {supplierAccount.name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tài khoản dùng API Key để tự động mua tài khoản số khi khách hàng đặt mua.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={supplierAccount.connectionStatus === "CONNECTED" ? "default" : "destructive"}
                className="text-xs font-semibold px-2.5 py-0.5"
              >
                {supplierAccount.connectionStatus === "CONNECTED" ? "🟢 API Hoạt động" : "🔴 Mất kết nối API"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncLiveBalance}
                disabled={syncingSupplier}
                className="h-8 text-xs font-bold gap-1.5"
              >
                {syncingSupplier ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
                Lấy số dư thực tế
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-xl bg-background/80 p-3.5 border shadow-sm">
              <span className="text-muted-foreground block text-[11px] font-medium">Tên tài khoản tại NCC</span>
              <span className="font-mono font-black text-base text-primary mt-1 block">
                {supplierAccount.username}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block truncate">
                {supplierAccount.baseUrl}
              </span>
            </div>

            <div className="rounded-xl bg-background/80 p-3.5 border shadow-sm">
              <span className="text-muted-foreground block text-[11px] font-medium">Số dư thực tế tại NCC (Live)</span>
              <span className="font-black text-base text-foreground mt-1 block">
                {Number(supplierAccount.liveBalance || 0).toLocaleString("vi-VN")}đ
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
                {Number(supplierAccount.liveBalance || 0) <= 0 ? "⚠️ Hết số dư vốn tại NCC" : "Khả dụng mua hàng"}
              </span>
            </div>

            <div className="rounded-xl bg-background/80 p-3.5 border shadow-sm">
              <span className="text-muted-foreground block text-[11px] font-medium">Ngưỡng cảnh báo vốn thấp</span>
              <span className="font-black text-base text-amber-600 mt-1 block">
                {Number(supplierAccount.alertThreshold || 0).toLocaleString("vi-VN")}đ
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Gửi email tự động khi dưới ngưỡng
              </span>
            </div>

            <div className="rounded-xl bg-background/80 p-3.5 border shadow-sm">
              <span className="text-muted-foreground block text-[11px] font-medium">Kiểm tra kết nối gần nhất</span>
              <span className="font-bold text-xs mt-1 block">
                {supplierAccount.lastCheckedAt
                  ? new Date(supplierAccount.lastCheckedAt).toLocaleString("vi-VN")
                  : "Chưa kiểm tra"}
              </span>
              <Link
                href="/admin/suppliers"
                className="text-[10px] text-primary hover:underline font-semibold mt-1 inline-flex items-center gap-0.5"
              >
                Cài đặt chi tiết NCC &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Đơn thành công</span>
            <span className="text-2xl font-black text-emerald-600">{metrics.successOrders || 0}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            ✓
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Đơn cần đối soát</span>
            <span className="text-2xl font-black text-amber-600">{metrics.reconciliationOrders || 0}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            !
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Khách hàng đăng ký</span>
            <span className="text-2xl font-black text-foreground">{metrics.totalUsers || 0}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-base">Đơn hàng mới nhất</h3>
          <Button variant="ghost" size="sm" asChild className="text-xs font-semibold">
            <Link href="/admin/orders">
              Xem tất cả đơn <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Chưa có đơn hàng nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Mã đơn</th>
                  <th className="py-2.5 px-3">Khách hàng</th>
                  <th className="py-2.5 px-3">Sản phẩm</th>
                  <th className="py-2.5 px-3">Tổng tiền</th>
                  <th className="py-2.5 px-3">Lợi nhuận</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentOrders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="py-3 px-3 font-mono font-bold">{o.orderCode}</td>
                    <td className="py-3 px-3 text-muted-foreground">{o.customerEmail}</td>
                    <td className="py-3 px-3 font-medium max-w-xs truncate">{o.productName}</td>
                    <td className="py-3 px-3 font-bold text-foreground">
                      {Number(o.totalAmount).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-600">
                      +{Number(o.profit).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          o.status === "SUCCESS"
                            ? "default"
                            : o.status === "RECONCILIATION"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {o.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

