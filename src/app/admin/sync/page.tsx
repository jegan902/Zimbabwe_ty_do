"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Play, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminSyncPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchSuppliersAndLogs = async () => {
    try {
      const res = await fetch("/api/admin/suppliers");
      const json = await res.json();
      if (res.ok && json.data?.length > 0) {
        setSuppliers(json.data);
        const firstId = json.data[0].id;
        setSelectedSupplierId(firstId);
        loadLogs(firstId);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (supplierId: string) => {
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/sync-logs`);
      const json = await res.json();
      if (res.ok) {
        setLogs(json.data || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchSuppliersAndLogs();
  }, []);

  const handleSync = async () => {
    if (!selectedSupplierId) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Đồng bộ thất bại");
      toast.success(
        `Đồng bộ hoàn tất: ${json.data.newProducts} mới, ${json.data.updatedProducts} cập nhật, ${json.data.priceChangedProducts} đổi giá`
      );
      loadLogs(selectedSupplierId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Trung Tâm Quản Lý Đồng Bộ</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi tiến trình đồng bộ dữ liệu sản phẩm, giá nhập và cập nhật trạng thái tự động.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSupplierId}
            onChange={(e) => {
              setSelectedSupplierId(e.target.value);
              loadLogs(e.target.value);
            }}
            className="h-9 rounded-lg border bg-background px-3 text-xs font-semibold"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.adapterKey})
              </option>
            ))}
          </select>

          <Button onClick={handleSync} disabled={syncing} size="sm" className="font-bold text-xs gap-1.5 shadow-sm">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Kích hoạt đồng bộ ngay
          </Button>
        </div>
      </div>

      {/* Sync Logs Table */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-base">Nhật ký các lần đồng bộ gần nhất</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadLogs(selectedSupplierId)}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Làm mới
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Chưa có lịch sử đồng bộ nào cho nhà cung cấp này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Bắt đầu</th>
                  <th className="py-2.5 px-3">Thời lượng</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Tổng SP</th>
                  <th className="py-2.5 px-3">SP Mới</th>
                  <th className="py-2.5 px-3">Cập nhật</th>
                  <th className="py-2.5 px-3">Đổi giá</th>
                  <th className="py-2.5 px-3">Lỗi</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.startedAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : "-"}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[10px]">
                        {log.trigger}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-bold">{log.totalProducts}</td>
                    <td className="py-3 px-3 text-emerald-600 font-semibold">+{log.newProducts}</td>
                    <td className="py-3 px-3 text-blue-600 font-semibold">{log.updatedProducts}</td>
                    <td className="py-3 px-3 text-amber-600 font-semibold">{log.priceChangedProducts}</td>
                    <td className="py-3 px-3 text-destructive font-semibold">{log.failedProducts}</td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          log.status === "SUCCESS"
                            ? "default"
                            : log.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {log.status}
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

