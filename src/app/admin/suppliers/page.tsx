"use client";

import { useEffect, useState } from "react";
import { Truck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Play, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit balance modal
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [newBalance, setNewBalance] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/admin/suppliers");
      const json = await res.json();
      if (res.ok) {
        setSuppliers(json.data || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleTestConnection = async (supplierId: string) => {
    setActionLoading(`test-${supplierId}`);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/test-connection`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Kiểm tra kết nối thất bại");
      }
      toast.success("Kết nối thành công tới nhà cung cấp!");
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncNow = async (supplierId: string) => {
    setActionLoading(`sync-${supplierId}`);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Đồng bộ thất bại");
      }
      toast.success(
        `Đồng bộ hoàn tất! ${json.data.newProducts} mới, ${json.data.updatedProducts} cập nhật, ${json.data.priceChangedProducts} đổi giá.`
      );
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveBalance = async () => {
    if (!editingSupplier) return;
    setActionLoading("save-balance");
    try {
      const res = await fetch(`/api/admin/suppliers/${editingSupplier.id}/balance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance: Number(newBalance),
          alertThreshold: Number(newThreshold),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Cập nhật số dư thất bại");
      toast.success("Đã cập nhật số dư vốn thành công!");
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-black">Quản lý Nhà Cung Cấp & Vốn</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Theo dõi kết nối API, cập nhật vốn nạp trước và kiểm tra trạng thái từng nhà cung cấp.
        </p>
      </div>

      <div className="space-y-4">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{s.name}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {s.adapterKey}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.baseUrl}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    s.connectionStatus === "CONNECTED"
                      ? "default"
                      : s.connectionStatus === "ERROR"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {s.connectionStatus === "CONNECTED"
                    ? "Đã kết nối"
                    : s.connectionStatus === "ERROR"
                    ? "Lỗi kết nối"
                    : "Chưa kiểm tra"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="rounded-xl bg-muted/40 p-3 border">
                <span className="text-muted-foreground block text-[11px]">Số dư vốn hiện tại</span>
                <span className="font-black text-base text-foreground mt-0.5 block">
                  {Number(s.balance?.balance || 0).toLocaleString("vi-VN")}đ
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Loại: {s.balance?.balanceType || "ESTIMATED"}
                </span>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 border">
                <span className="text-muted-foreground block text-[11px]">Ngưỡng cảnh báo số dư</span>
                <span className="font-black text-base text-amber-600 mt-0.5 block">
                  {Number(s.balance?.alertThreshold || 0).toLocaleString("vi-VN")}đ
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Tự động gửi email khi dưới ngưỡng
                </span>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 border">
                <span className="text-muted-foreground block text-[11px]">Sản phẩm nguồn</span>
                <span className="font-black text-base text-foreground mt-0.5 block">
                  {s.productCount} sản phẩm
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Lợi nhuận: +{s.profitValue}%
                </span>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 border">
                <span className="text-muted-foreground block text-[11px]">Đồng bộ gần nhất</span>
                <span className="font-bold text-xs mt-0.5 block">
                  {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString("vi-VN") : "Chưa đồng bộ"}
                </span>
                {s.lastSyncError && (
                  <span className="text-[10px] text-destructive mt-1 block truncate">
                    {s.lastSyncError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingSupplier(s);
                  setNewBalance(s.balance?.balance || "0");
                  setNewThreshold(s.balance?.alertThreshold || "100000");
                }}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <DollarSign className="h-3.5 w-3.5" /> Điều chỉnh số dư
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection(s.id)}
                disabled={actionLoading === `test-${s.id}`}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {actionLoading === `test-${s.id}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Kiểm tra API
              </Button>

              <Button
                size="sm"
                onClick={() => handleSyncNow(s.id)}
                disabled={actionLoading === `sync-${s.id}`}
                className="h-8 text-xs font-bold gap-1.5 shadow-sm"
              >
                {actionLoading === `sync-${s.id}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Đồng bộ ngay
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Balance Dialog */}
      {editingSupplier && (
        <Dialog open={true} onOpenChange={() => setEditingSupplier(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Điều chỉnh số dư vốn: {editingSupplier.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Số dư vốn hiện tại (VNĐ)
                </label>
                <Input
                  type="number"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="h-9 text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Ngưỡng cảnh báo số dư thấp (VNĐ)
                </label>
                <Input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="h-9 text-sm font-bold"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSupplier(null)}>
                Hủy
              </Button>
              <Button onClick={handleSaveBalance} disabled={actionLoading === "save-balance"}>
                {actionLoading === "save-balance" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

