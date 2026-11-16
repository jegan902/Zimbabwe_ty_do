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
  const [syncingSupplierId, setSyncingSupplierId] = useState<string | null>(null);

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
  const supplierAccounts: any[] = data?.supplierAccounts || (data?.supplierAccount ? [data.supplierAccount] : []);

  const handleSyncLiveBalance = async (supplierId: string) => {
    if (!supplierId) return;
    setSyncingSupplierId(supplierId);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/test-connection`, {
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
      setSyncingSupplierId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Dashboard Tổng Quan</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi doanh thu, lợi nhuận, số dư ví khách, các tài khoản nhà cung cấp và vận hành hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="text-xs font-semibold">
            <Link href="/admin/deposits">Quản lý nạp tiền &rarr;</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="text-xs font-semibold">
            <Link href="/admin/users">Quản lý khách hàng &rarr;</Link>
          </Button>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Doanh thu */}
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

        {/* Card 2: Lợi nhuận gộp */}
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

        {/* Card 3: Tổng tiền trong tài khoản khách hàng */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2 relative overflow-hidden border-amber-500/30">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tổng tiền ví khách</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {Number(metrics.totalCustomerWallet || 0).toLocaleString("vi-VN")}đ
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
            <span>Khả dụng: <strong className="text-foreground">{Number(metrics.totalCustomerAvailable || 0).toLocaleString("vi-VN")}đ</strong></span>
            {Number(metrics.totalCustomerReserved || 0) > 0 && (
              <span className="text-amber-600 font-semibold">Giữ đơn: {Number(metrics.totalCustomerReserved).toLocaleString("vi-VN")}đ</span>
            )}
          </div>
        </div>

        {/* Card 4: Tổng tiền đã nạp */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Tổng tiền đã nạp</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {Number(metrics.totalCustomerDeposits || 0).toLocaleString("vi-VN")}đ
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics.verifiedDepositCount ? `${metrics.verifiedDepositCount} giao dịch duyệt` : "Đã xác nhận qua cổng nạp"}
          </p>
        </div>

        {/* Card 5: Vốn tại các nhà cung cấp */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Vốn tại nhà cung cấp</span>
            <Truck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {Number(metrics.totalSupplierBalances || 0).toLocaleString("vi-VN")}đ
          </div>
          <p className="text-[11px] text-muted-foreground">Tổng vốn trên tất cả NCC</p>
        </div>
      </div>

      {/* Intermediary Supplier Accounts Section */}
      <div className="rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base">Tài Khoản Trung Gian Nhà Cung Cấp</h3>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  {supplierAccounts.length} Tài khoản kết nối
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Các tài khoản API kết nối tự động mua sản phẩm số khi khách hàng đặt hàng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 text-xs font-bold gap-1.5">
              <Link href="/admin/suppliers">
                Cài đặt chi tiết NCC &rarr;
              </Link>
            </Button>
          </div>
        </div>

        {supplierAccounts.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Chưa có nhà cung cấp nào đang hoạt động. <Link href="/admin/suppliers" className="text-primary underline">Thêm nhà cung cấp ngay</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplierAccounts.map((acc: any) => {
              const isSyncing = syncingSupplierId === acc.id;
              const isLowBalance = Number(acc.liveBalance || 0) <= Number(acc.alertThreshold || 0);

              return (
                <div
                  key={acc.id}
                  className="rounded-xl bg-background/90 p-4 border shadow-sm space-y-3.5 hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-foreground truncate">{acc.name}</span>
                      <Badge
                        variant={acc.connectionStatus === "CONNECTED" ? "default" : "destructive"}
                        className="text-[10px] px-2 py-0 shrink-0 font-medium"
                      >
                        {acc.connectionStatus === "CONNECTED" ? "🟢 Hoạt động" : "🔴 Mất kết nối"}
                      </Badge>
                    </div>

                    <div className="text-[11px] space-y-1 text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Tài khoản NCC:</span>
                        <span className="font-mono font-bold text-primary">{acc.username || "Chưa cấu hình"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Base URL:</span>
                        <span className="font-mono text-[10px] truncate max-w-[170px]">{acc.baseUrl}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Số dư Live:</span>
                      <span className="font-black text-sm text-foreground">
                        {Number(acc.liveBalance || 0).toLocaleString("vi-VN")}đ
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Ngưỡng báo: {Number(acc.alertThreshold || 0).toLocaleString("vi-VN")}đ</span>
                      <span className={isLowBalance ? "text-amber-600 font-bold" : "text-emerald-600 font-semibold"}>
                        {isLowBalance ? "⚠️ Vốn thấp" : "Khả dụng"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {acc.lastCheckedAt ? new Date(acc.lastCheckedAt).toLocaleTimeString("vi-VN") : "Chưa kiểm tra"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncLiveBalance(acc.id)}
                        disabled={isSyncing}
                        className="h-7 text-[11px] font-bold px-2 text-primary hover:bg-primary/10 gap-1"
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        Lấy số dư
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

