"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Layers,
  Settings,
  Zap,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

/** Human-readable gap between "now" and the next scheduled run. */
function formatCountdown(target: string, now: number): { label: string; overdue: boolean } {
  const diffMs = new Date(target).getTime() - now;
  if (Number.isNaN(diffMs)) return { label: "", overdue: false };

  if (diffMs <= 0) {
    const lateSeconds = Math.floor(-diffMs / 1000);
    return {
      label:
        lateSeconds < 60
          ? `đang tới lượt (trễ ${lateSeconds}s)`
          : `đang tới lượt (trễ ${Math.floor(lateSeconds / 60)} phút)`,
      overdue: true,
    };
  }

  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return { label: `còn ${seconds} giây`, overdue: false };

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = seconds % 60;
    return { label: `còn ${minutes} phút${rest ? ` ${rest} giây` : ""}`, overdue: false };
  }

  return { label: `còn ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`, overdue: false };
}

/**
 * Owns its own 1-second timer so only this label re-renders — the table below
 * must not re-render every tick.
 */
function NextRunCountdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const { label, overdue } = formatCountdown(target, now);
  return (
    <span className={`font-semibold ${overdue ? "text-amber-600" : "text-muted-foreground"}`}>
      ({label})
    </span>
  );
}

export default function AdminSyncPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Sync settings for selected supplier
  const [syncSettings, setSyncSettings] = useState<{
    syncInterval: number;
    isAutoSyncEnabled: boolean;
    nextSyncAt: string | null;
  } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const selectedSupplierIdRef = useRef(selectedSupplierId);
  useEffect(() => {
    selectedSupplierIdRef.current = selectedSupplierId;
  }, [selectedSupplierId]);

  const loadLogsAndSettings = useCallback(async (supplierId: string) => {
    try {
      const [logsRes, settingsRes] = await Promise.all([
        fetch(`/api/admin/suppliers/${supplierId}/sync-logs`),
        fetch(`/api/admin/suppliers/${supplierId}/sync-settings`),
      ]);
      const logsJson = await logsRes.json();
      const settingsJson = await settingsRes.json();

      if (logsRes.ok) setLogs(logsJson.data || []);
      if (settingsRes.ok) setSyncSettings(settingsJson.data);
    } catch {
      // Ignored
    }
  }, []);

  const fetchSuppliersAndLogs = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        const res = await fetch("/api/admin/suppliers");
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : json.data?.suppliers || [];
        if (res.ok && list.length > 0) {
          setSuppliers(list);
          const currentId = selectedSupplierIdRef.current;
          const activeId =
            currentId && list.some((s: any) => s.id === currentId)
              ? currentId
              : list[0].id;
          setSelectedSupplierId(activeId);
          loadLogsAndSettings(activeId);
        }
      } catch {
        // Ignored
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadLogsAndSettings]
  );

  useEffect(() => {
    fetchSuppliersAndLogs();
  }, [fetchSuppliersAndLogs]);

  // Realtime SSE listener for sync status, logs and supplier balance
  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "sync.status" ||
          data.type === "product.synced" ||
          data.type === "supplier.balance"
        ) {
          fetchSuppliersAndLogs({ silent: true });
          toast.info("Đã tự động cập nhật số dư & lịch sử đồng bộ NCC!", {
            id: "realtime-sync-status",
            duration: 3000,
          });
        }
      } catch {}
    };
    return () => source.close();
  }, [fetchSuppliersAndLogs]);

  // The worker writes a new `nextSyncAt` and a new log row when a scheduled run
  // finishes. Nothing pushes that to the browser, so poll while the tab is open
  // — otherwise the time and the table stay frozen until a manual reload.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const supplierId = selectedSupplierIdRef.current;
      if (supplierId) loadLogsAndSettings(supplierId);
    }, 20_000);
    return () => clearInterval(timer);
  }, [loadLogsAndSettings]);

  // Sync Selected Supplier
  const handleSyncSelected = async () => {
    if (!selectedSupplierId) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Đồng bộ thất bại");
      toast.success(
        `Đồng bộ hoàn tất: ${json.data.newProducts} mới, ${json.data.updatedProducts} cập nhật, ${json.data.priceChangedProducts} đổi giá`
      );
      loadLogsAndSettings(selectedSupplierId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Sync All Suppliers Batch
  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/admin/sync/all", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Đồng bộ tất cả thất bại");
      toast.success(json.message || "Đồng bộ toàn bộ nhà cung cấp thành công!");
      if (selectedSupplierId) {
        loadLogsAndSettings(selectedSupplierId);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  // Save Auto-Sync Settings
  const handleSaveSettings = async () => {
    if (!selectedSupplierId || !syncSettings) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/sync-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncSettings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Lưu cài đặt thất bại");
      toast.success("Đã lưu cấu hình tự động đồng bộ thành công!");
      setSyncSettings(json.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && suppliers.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black">Trung Tâm Quản Lý Đồng Bộ</h1>
            {isRefreshing && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30 animate-pulse">
                Đang cập nhật live...
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi tiến trình đồng bộ dữ liệu sản phẩm, giá nhập và cập nhật trạng thái tự động từ các nhà cung cấp số.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => fetchSuppliersAndLogs({ silent: true })}
            disabled={loading || isRefreshing}
            variant="outline"
            size="sm"
            className="font-bold text-xs gap-1.5 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Làm mới
          </Button>

          <Button
            onClick={handleSyncAll}
            disabled={syncingAll}
            variant="outline"
            size="sm"
            className="font-bold text-xs gap-1.5 shadow-xs border-primary/30 text-primary hover:bg-primary/5"
          >
            {syncingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Đồng bộ TẤT CẢ NCC ({suppliers.length})
          </Button>

          <Link href="/admin/products">
            <Button size="sm" className="font-bold text-xs gap-1.5 shadow-sm">
              Xem danh sách sản phẩm <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Supplier Selector & Quick Action Bar */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Đang chọn nhà cung cấp:</span>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  loadLogsAndSettings(e.target.value);
                }}
                className="h-8 rounded-lg border bg-background px-3 text-xs font-bold text-foreground"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.adapterKey})
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {selectedSupplier.productCount || 0} sản phẩm
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSyncSelected}
            disabled={syncing}
            size="sm"
            className="font-bold text-xs gap-1.5 shadow-sm"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Đồng bộ ngay cho NCC này
          </Button>
        </div>
      </div>

      {/* Auto-Sync Configuration Box */}
      {syncSettings && (
        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Cấu hình tự động đồng bộ (Background Worker)</h3>
            </div>
            {syncSettings.nextSyncAt && (
              <span className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
                <Clock className="h-3 w-3" /> Lần chạy kế tiếp của{" "}
                <span className="font-semibold text-foreground">{selectedSupplier?.name ?? "NCC đang chọn"}</span>
                :{" "}
                <span className="font-mono font-semibold text-foreground">
                  {new Date(syncSettings.nextSyncAt).toLocaleTimeString("vi-VN")}
                </span>
                <NextRunCountdown target={syncSettings.nextSyncAt} />
              </span>
            )}
            {!syncSettings.isAutoSyncEnabled && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {selectedSupplier?.name ?? "NCC đang chọn"} không có lịch tự chạy (đang tắt)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs items-end">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground block">Trạng thái tự động</label>
              <button
                type="button"
                onClick={() =>
                  setSyncSettings({ ...syncSettings, isAutoSyncEnabled: !syncSettings.isAutoSyncEnabled })
                }
                className={`w-full h-9 rounded-lg border px-3 text-xs font-bold text-left flex items-center justify-between transition-colors ${
                  syncSettings.isAutoSyncEnabled
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                    : "bg-muted border-muted text-muted-foreground"
                }`}
              >
                <span>{syncSettings.isAutoSyncEnabled ? "Đang BẬT tự động" : "Đang TẮT"}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${syncSettings.isAutoSyncEnabled ? "bg-emerald-500" : "bg-muted-foreground"}`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-muted-foreground">Tần suất đồng bộ</label>
                <span className="text-[10px] text-muted-foreground">
                  Áp dụng cho {selectedSupplier?.name ?? "NCC đang chọn"}
                </span>
              </div>
              <select
                value={syncSettings.syncInterval}
                onChange={(e) =>
                  setSyncSettings({ ...syncSettings, syncInterval: Number(e.target.value) })
                }
                className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-bold"
              >
                <option value={60}>1 phút / lần (Thời gian thực)</option>
                <option value={300}>5 phút / lần (Mặc định)</option>
                <option value={900}>15 phút / lần</option>
                <option value={1800}>30 phút / lần</option>
                <option value={3600}>1 giờ / lần</option>
              </select>
            </div>

            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full h-9 text-xs font-bold"
              >
                {savingSettings && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Lưu cài đặt đồng bộ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Logs Table */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-base">Nhật ký các lần đồng bộ gần nhất</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lịch sử chi tiết các lần quét sản phẩm, biến động giá và thêm mới SKU.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => selectedSupplierId && loadLogsAndSettings(selectedSupplierId)}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Làm mới
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <RefreshCw className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p>Chưa có lịch sử đồng bộ nào cho nhà cung cấp này.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncSelected}
              className="text-xs font-bold mt-2"
            >
              Kích hoạt lần đồng bộ đầu tiên
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Thời gian bắt đầu</th>
                  <th className="py-2.5 px-3">Thời lượng</th>
                  <th className="py-2.5 px-3">Kích hoạt bởi</th>
                  <th className="py-2.5 px-3 text-center">Tổng SKU</th>
                  <th className="py-2.5 px-3 text-center text-emerald-600">Thêm mới</th>
                  <th className="py-2.5 px-3 text-center text-blue-600">Cập nhật</th>
                  <th className="py-2.5 px-3 text-center text-amber-600">Đổi giá</th>
                  <th className="py-2.5 px-3 text-center text-destructive">Lỗi</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 text-foreground font-medium whitespace-nowrap">
                      {new Date(log.startedAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-3 font-mono text-muted-foreground">
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : "-"}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {log.trigger}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-bold text-center">{log.totalProducts}</td>
                    <td className="py-3 px-3 text-emerald-600 font-bold text-center">+{log.newProducts}</td>
                    <td className="py-3 px-3 text-blue-600 font-semibold text-center">{log.updatedProducts}</td>
                    <td className="py-3 px-3 text-amber-600 font-bold text-center">
                      {log.priceChangedProducts > 0 ? (
                        <span className="bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">
                          {log.priceChangedProducts}
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="py-3 px-3 text-destructive font-semibold text-center">
                      {log.failedProducts}
                    </td>
                    <td className="py-3 px-3 text-center">
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
                        {log.status === "SUCCESS" ? "Thành công" : log.status === "FAILED" ? "Thất bại" : log.status}
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
