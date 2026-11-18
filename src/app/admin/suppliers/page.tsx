"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Truck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Loader2,
  DollarSign,
  Settings,
  KeyRound,
  Plus,
  Trash2,
  Power,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** "1440" → "1 ngày", "90" → "1 giờ 30 phút". */
function formatRepeatWindow(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.round(minutes % 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  if (mins) parts.push(`${mins} phút`);
  return parts.join(" ") || "0 phút";
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [availableAdapters, setAvailableAdapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<{
    smtpConfigured: boolean;
    recipients: string[];
  } | null>(null);
  const [alertSettings, setAlertSettings] = useState<{
    repeatMinutes: number;
    minRepeatMinutes: number;
    maxRepeatMinutes: number;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repeatMinutesInput, setRepeatMinutesInput] = useState("1440");
  const [recipientsInput, setRecipientsInput] = useState("");

  // Create Supplier modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAdapterKey, setNewAdapterKey] = useState("quangvinh");
  const [newBaseUrl, setNewBaseUrl] = useState(
    "https://quangvinhmedia.store/api",
  );
  const [newApiKey, setNewApiKey] = useState("");
  const [newProfitType, setNewProfitType] = useState<"PERCENTAGE" | "FIXED">(
    "PERCENTAGE",
  );
  const [newProfitValue, setNewProfitValue] = useState("10");
  const [newAlertThreshold, setNewAlertThreshold] = useState("50000");

  // Edit balance modal
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [newBalance, setNewBalance] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  // Edit config / API Key modal
  const [configSupplier, setConfigSupplier] = useState<any>(null);
  const [editApiKey, setEditApiKey] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editProfitValue, setEditProfitValue] = useState("");
  const [editAdapterKey, setEditAdapterKey] = useState("quangvinh");

  const fetchSuppliers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const res = await fetch("/api/admin/suppliers");
      const json = await res.json();
      if (res.ok) {
        if (Array.isArray(json.data)) {
          setSuppliers(json.data);
        } else if (json.data?.suppliers) {
          setSuppliers(json.data.suppliers);
          if (json.data.availableAdapters) {
            setAvailableAdapters(json.data.availableAdapters);
          }
        }
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const fetchNotifyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      const json = await res.json();
      if (res.ok && json.data) {
        setNotifyStatus({
          smtpConfigured: Boolean(json.data.smtpConfigured),
          recipients: Array.isArray(json.data.recipients)
            ? json.data.recipients
            : [],
        });
        const settings = json.data.settings;
        if (settings) {
          setAlertSettings({
            repeatMinutes: Number(settings.repeatMinutes) || 1440,
            minRepeatMinutes: Number(settings.minRepeatMinutes) || 5,
            maxRepeatMinutes: Number(settings.maxRepeatMinutes) || 20160,
          });
        }
      }
    } catch {
      // Ignored: the banner simply stays hidden.
    }
  }, []);

  useEffect(() => {
    fetchNotifyStatus();
  }, [fetchNotifyStatus]);

  // Realtime SSE listener for supplier balance and sync events without full reload flicker
  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "supplier.balance" ||
          data.type === "sync.status" ||
          data.type === "product.synced"
        ) {
          fetchSuppliers({ silent: true });
        }
      } catch {}
    };
    return () => source.close();
  }, [fetchSuppliers]);

  const handleCheckBalanceAlerts = async () => {
    setActionLoading("check-balance-alerts");
    try {
      const res = await fetch("/api/admin/notifications/check-balance", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Kiểm tra số dư thất bại");
      toast.success(json.message || "Đã kiểm tra số dư nhà cung cấp");
      await fetchNotifyStatus();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kiểm tra số dư thất bại",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAlertSettings = async () => {
    setActionLoading("save-alert-settings");
    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repeatMinutes: Number(repeatMinutesInput),
          recipients: recipientsInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Lưu cài đặt thất bại");
      toast.success(json.message || "Đã lưu cài đặt cảnh báo số dư");
      setSettingsOpen(false);
      await fetchNotifyStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu cài đặt thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestConnection = async (supplierId: string) => {
    setActionLoading(`test-${supplierId}`);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${supplierId}/test-connection`,
        {
          method: "POST",
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.message ||
            json.error?.message ||
            json.error ||
            "Kiểm tra kết nối thất bại",
        );
      }
      toast.success("Kết nối thành công tới nhà cung cấp!");
      fetchSuppliers({ silent: true });
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
        throw new Error(
          json.message ||
            json.error?.message ||
            json.error ||
            "Đồng bộ thất bại",
        );
      }
      toast.success(
        `Đồng bộ hoàn tất! ${json.data.newProducts} mới, ${json.data.updatedProducts} cập nhật, ${json.data.priceChangedProducts} đổi giá.`,
      );
      fetchSuppliers({ silent: true });
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
      const res = await fetch(
        `/api/admin/suppliers/${editingSupplier.id}/balance`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            balance: Number(newBalance),
            alertThreshold: Number(newThreshold),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message || "Cập nhật số dư thất bại");
      toast.success("Đã cập nhật số dư vốn thành công!");
      setEditingSupplier(null);
      fetchSuppliers({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!configSupplier) return;
    setActionLoading("save-config");
    try {
      const res = await fetch(`/api/admin/suppliers/${configSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: editApiKey.trim() || undefined,
          baseUrl: editBaseUrl.trim() || undefined,
          profitValue: editProfitValue ? Number(editProfitValue) : undefined,
          adapterKey: editAdapterKey || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.message || json.error?.message || "Cập nhật thất bại",
        );
      toast.success("Đã cập nhật API Key & cấu hình nhà cung cấp thành công!");
      setConfigSupplier(null);
      setEditApiKey("");
      fetchSuppliers({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newName.trim() || !newBaseUrl.trim() || !newApiKey.trim()) {
      toast.error("Vui lòng điền đầy đủ Tên, Base URL và API Key");
      return;
    }
    setActionLoading("create-supplier");
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          adapterKey: newAdapterKey,
          baseUrl: newBaseUrl.trim(),
          apiKey: newApiKey.trim(),
          profitType: newProfitType,
          profitValue: Number(newProfitValue) || 10,
          alertThreshold: Number(newAlertThreshold) || 50000,
        }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.message || json.error?.message || "Thêm nhà cung cấp thất bại",
        );
      toast.success(`Đã thêm nhà cung cấp "${newName}" thành công!`);
      setCreateModalOpen(false);
      setNewName("");
      setNewApiKey("");
      fetchSuppliers({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSupplier = async (
    supplierId: string,
    supplierName: string,
  ) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa hoặc vô hiệu hóa nhà cung cấp "${supplierName}"?`,
      )
    )
      return;
    setActionLoading(`delete-${supplierId}`);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.message || json.error?.message || "Thao tác thất bại",
        );
      toast.success(json.message || "Đã xóa nhà cung cấp thành công!");
      fetchSuppliers({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (supplier: any) => {
    const isStopping = supplier.status === "ACTIVE";
    const nextStatus = isStopping ? "INACTIVE" : "ACTIVE";

    if (
      isStopping &&
      !confirm(
        `Bạn có chắc chắn muốn NGỪNG BÁN toàn bộ sản phẩm của "${supplier.name}"?\n\nToàn bộ sản phẩm thuộc nhà cung cấp này sẽ bị ẨN khỏi trang bán hàng và khách hàng không thể tìm kiếm hay mua được nữa.`,
      )
    ) {
      return;
    }

    // Optimistic update
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplier.id ? { ...s, status: nextStatus } : s,
      ),
    );

    setActionLoading(`toggle-${supplier.id}`);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.message || json.error?.message || "Cập nhật trạng thái thất bại",
        );
      if (nextStatus === "INACTIVE") {
        toast.warning(
          `Đã NGỪNG BÁN "${supplier.name}". Toàn bộ sản phẩm của nhà cung cấp này đã được ẨN khỏi trang bán hàng!`,
          { duration: 4000 },
        );
      } else {
        toast.success(
          `Đã MỞ BÁN LẠI "${supplier.name}". Sản phẩm đã được hiển thị trở lại trên trang bán hàng!`,
          { duration: 4000 },
        );
      }
      fetchSuppliers({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
      fetchSuppliers({ silent: true });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && suppliers.length === 0) {
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black">Quản lý Nhà Cung Cấp & Vốn</h1>
            {isRefreshing && (
              <Badge
                variant="outline"
                className="text-[10px] text-primary border-primary/30 animate-pulse"
              >
                Đang cập nhật live...
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mở rộng kết nối đa nhà cung cấp số, theo dõi kết nối API và hạn mức
            vốn nạp trước.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRepeatMinutesInput(
                String(alertSettings?.repeatMinutes ?? 1440),
              );
              setRecipientsInput((notifyStatus?.recipients ?? []).join(", "));
              setSettingsOpen(true);
            }}
            className="font-bold text-xs gap-1.5 shadow-xs"
          >
            <Settings className="h-3.5 w-3.5" />
            Cài đặt cảnh báo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckBalanceAlerts}
            disabled={actionLoading === "check-balance-alerts"}
            className="font-bold text-xs gap-1.5 shadow-xs"
          >
            {actionLoading === "check-balance-alerts" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            Kiểm tra số dư
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSuppliers({ silent: true })}
            disabled={loading || isRefreshing}
            className="font-bold text-xs gap-1.5 shadow-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
          <Button
            onClick={() => {
              setNewName("");
              setNewApiKey("");
              setCreateModalOpen(true);
            }}
            size="sm"
            className="font-bold text-xs gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Thêm nhà cung cấp mới
          </Button>
        </div>
      </div>

      {notifyStatus &&
        (!notifyStatus.smtpConfigured ||
          notifyStatus.recipients.length === 0) && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold">
                  Cảnh báo số dư chưa gửi được email
                </p>
                <p className="text-xs leading-relaxed">
                  {!notifyStatus.smtpConfigured &&
                    "Thiếu cấu hình SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS). "}
                  {notifyStatus.recipients.length === 0 &&
                    "Chưa đặt ADMIN_ALERT_EMAIL. "}
                  Hệ thống vẫn phát hiện số dư dưới ngưỡng nhưng email sẽ ở
                  trạng thái SKIPPED trong bảng EmailNotification.
                </p>
              </div>
            </div>
          </div>
        )}

      <div className="space-y-6">
        {suppliers.map((s) => {
          const intermediaryUser = s.accountProfile?.username || "Unknows";
          const liveBal =
            s.accountProfile?.balance ?? s.balance?.balance ?? "0";
          const isConnected = s.connectionStatus === "CONNECTED";

          return (
            <div
              key={s.id}
              className="rounded-2xl border bg-card p-6 shadow-sm space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg">{s.name}</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-primary/30 text-primary"
                      >
                        Adapter: {s.adapterKey}
                      </Badge>
                      {s.status === "ACTIVE" ? (
                        <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                          🟢 Đang bán
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="font-bold text-[10px]"
                        >
                          🔴 ĐÃ NGỪNG BÁN (ẨN KHỎI WEB)
                        </Badge>
                      )}
                      <Badge
                        variant={
                          isConnected
                            ? "default"
                            : s.connectionStatus === "ERROR"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[11px] font-semibold"
                      >
                        {isConnected
                          ? "🟢 Đã kết nối API"
                          : s.connectionStatus === "ERROR"
                            ? "🔴 Lỗi kết nối"
                            : "Chưa kiểm tra"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {s.baseUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                    Đồng bộ số dư thực tế từ NCC
                  </Button>
                </div>
              </div>

              {/* Intermediary Account Highlight Box */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    THÔNG TIN TÀI KHOẢN TRUNG GIAN KẾT NỐI (INTERMEDIARY
                    ACCOUNT)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Dùng API Key để tự động mua tài khoản số bằng tài khoản của
                    bạn tại NCC
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-card p-3 border shadow-xs">
                    <span className="text-muted-foreground block text-[11px] font-medium">
                      Tên tài khoản tại NCC
                    </span>
                    <span className="font-mono font-black text-base text-primary mt-0.5 block">
                      {intermediaryUser}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Tài khoản liên kết API
                    </span>
                  </div>

                  <div className="rounded-lg bg-card p-3 border shadow-xs">
                    <span className="text-muted-foreground block text-[11px] font-medium">
                      Số dư thực tế tại NCC (Live API)
                    </span>
                    <span className="font-black text-base text-foreground mt-0.5 block">
                      {Number(liveBal).toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
                      {Number(liveBal) <= 0
                        ? "⚠️ Số dư vốn NCC đang bằng 0"
                        : "Xác nhận từ profile.php"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-card p-3 border shadow-xs">
                    <span className="text-muted-foreground block text-[11px] font-medium">
                      Trạng thái API & Ping
                    </span>
                    <span className="font-bold text-xs mt-1 block">
                      {s.lastCheckedAt
                        ? new Date(s.lastCheckedAt).toLocaleString("vi-VN")
                        : "Chưa kiểm tra"}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Timeout cấu hình: {s.timeoutMs / 1000}s
                    </span>
                  </div>
                </div>
              </div>

              {/* System Working Capital Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div className="rounded-xl bg-muted/40 p-3.5 border">
                  <span className="text-muted-foreground block text-[11px]">
                    Số dư vốn ghi nhận trong DB
                  </span>
                  <span className="font-black text-base text-foreground mt-0.5 block">
                    {Number(s.balance?.balance || 0).toLocaleString("vi-VN")}đ
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Loại:{" "}
                    <Badge variant="outline" className="text-[9px] py-0 px-1">
                      {s.balance?.balanceType || "ESTIMATED"}
                    </Badge>
                  </span>
                </div>

                <div className="rounded-xl bg-muted/40 p-3.5 border">
                  <span className="text-muted-foreground block text-[11px]">
                    Ngưỡng cảnh báo vốn thấp
                  </span>
                  <span className="font-black text-base text-amber-600 mt-0.5 block">
                    {Number(s.balance?.alertThreshold || 0).toLocaleString(
                      "vi-VN",
                    )}
                    đ
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Tự gửi email cảnh báo khi dưới ngưỡng
                  </span>
                </div>

                <div className="rounded-xl bg-muted/40 p-3.5 border">
                  <span className="text-muted-foreground block text-[11px]">
                    Sản phẩm nguồn đang liên kết
                  </span>
                  <span className="font-black text-base text-foreground mt-0.5 block">
                    {s.productCount} sản phẩm
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Lợi nhuận: +{s.profitValue}%
                  </span>
                </div>

                <div className="rounded-xl bg-muted/40 p-3.5 border">
                  <span className="text-muted-foreground block text-[11px]">
                    Đồng bộ catalog gần nhất
                  </span>
                  <span className="font-bold text-xs mt-0.5 block">
                    {s.lastSyncAt
                      ? new Date(s.lastSyncAt).toLocaleString("vi-VN")
                      : "Chưa đồng bộ"}
                  </span>
                  {s.lastSyncError ? (
                    <span className="text-[10px] text-destructive mt-1 block truncate">
                      {s.lastSyncError}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 mt-1 block">
                      Hoạt động bình thường
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
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
                  <DollarSign className="h-3.5 w-3.5" /> Điều chỉnh số dư &
                  Ngưỡng
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfigSupplier(s);
                    setEditBaseUrl(s.baseUrl || "");
                    setEditProfitValue(s.profitValue || "10");
                    setEditAdapterKey(s.adapterKey || "quangvinh");
                    setEditApiKey("");
                  }}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <Settings className="h-3.5 w-3.5" /> Cài đặt API Key & NCC
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStatus(s)}
                  disabled={actionLoading === `toggle-${s.id}`}
                  className={`h-8 text-xs font-semibold gap-1.5 ${
                    s.status === "ACTIVE"
                      ? "text-destructive border-destructive/30 hover:bg-destructive/10 font-bold"
                      : "text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 font-bold"
                  }`}
                  title={
                    s.status === "ACTIVE"
                      ? "Ngừng bán và ẩn toàn bộ sản phẩm của nhà cung cấp này khỏi trang web"
                      : "Mở bán lại và hiển thị sản phẩm trên trang web"
                  }
                >
                  {actionLoading === `toggle-${s.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : s.status === "ACTIVE" ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Ngừng bán (Ẩn khỏi web)
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Mở bán lại (Hiện lên web)
                    </>
                  )}
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
                  Kiểm tra kết nối API
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
                  Đồng bộ sản phẩm ngay
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSupplier(s.id, s.name)}
                  disabled={actionLoading === `delete-${s.id}`}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
                  title="Xóa hoặc vô hiệu hóa nhà cung cấp"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
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
              <Button
                variant="outline"
                onClick={() => setEditingSupplier(null)}
              >
                Hủy
              </Button>
              <Button
                onClick={handleSaveBalance}
                disabled={actionLoading === "save-balance"}
              >
                {actionLoading === "save-balance" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Config / API Key Dialog */}
      {configSupplier && (
        <Dialog open={true} onOpenChange={() => setConfigSupplier(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Cài đặt API Key & Nhà cung cấp: {configSupplier.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mỗi nhà cung cấp được cấu hình một API Key của bạn để hệ thống
                tự động mua tài khoản số.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  API Key mới (để trống nếu giữ nguyên)
                </label>
                <Input
                  type="password"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="Nhập API Key mới từ nhà cung cấp..."
                  className="h-9 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  API Key được mã hóa AES-256 trước khi lưu vào database và
                  không bao giờ gửi ra trình duyệt.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  Loại Adapter kết nối
                </label>
                <select
                  value={editAdapterKey}
                  onChange={(e) => setEditAdapterKey(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold"
                >
                  {availableAdapters.length > 0 ? (
                    availableAdapters.map((a: any) => (
                      <option key={a.key} value={a.key}>
                        {a.name} ({a.key})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="quangvinh">
                        Quang Vinh Media API (quangvinh)
                      </option>
                      <option value="taphoammo">
                        Tạp Hóa MMO / REST JSON API (taphoammo)
                      </option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  API Base URL
                </label>
                <Input
                  type="text"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  placeholder="https://quangvinhmedia.store/api"
                  className="h-9 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  % Lợi nhuận mặc định cộng vào giá nhập
                </label>
                <Input
                  type="number"
                  value={editProfitValue}
                  onChange={(e) => setEditProfitValue(e.target.value)}
                  placeholder="10"
                  className="h-9 font-bold text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ví dụ: 10% nghĩa là giá nhập 100.000đ sẽ tự động bán ra
                  110.000đ.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigSupplier(null)}>
                Hủy
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={actionLoading === "save-config"}
              >
                {actionLoading === "save-config" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lưu cấu hình
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Supplier Dialog */}
      {createModalOpen && (
        <Dialog open={true} onOpenChange={() => setCreateModalOpen(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Thêm Nhà Cung Cấp Mới
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mở rộng kết nối tới nhà cung cấp số mới để đồng bộ sản phẩm và
                tự động đặt hàng.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  Tên nhà cung cấp *
                </label>
                <Input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Tạp Hóa MMO, Chợ Số 247..."
                  className="h-9 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  Loại Adapter kết nối *
                </label>
                <select
                  value={newAdapterKey}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setNewAdapterKey(selected);
                    const found = availableAdapters.find(
                      (a: any) => a.key === selected,
                    );
                    if (found?.defaultBaseUrl) {
                      setNewBaseUrl(found.defaultBaseUrl);
                    }
                  }}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold"
                >
                  {availableAdapters.length > 0 ? (
                    availableAdapters.map((a: any) => (
                      <option key={a.key} value={a.key}>
                        {a.name} ({a.key})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="taphoammo">
                        Tạp Hóa MMO / REST JSON API (taphoammo)
                      </option>
                      <option value="quangvinh">
                        Quang Vinh Media API (quangvinh)
                      </option>
                    </>
                  )}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Mỗi nhà cung cấp sử dụng một adapter chuẩn hóa dữ liệu tài
                  khoản, danh mục và đơn hàng.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  API Base URL *
                </label>
                <Input
                  type="text"
                  required
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="https://taphoammo.net/api"
                  className="h-9 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  API Key của bạn tại nhà cung cấp *
                </label>
                <Input
                  type="password"
                  required
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Nhập API Key cung cấp bởi đối tác..."
                  className="h-9 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Khóa API được mã hóa an toàn bằng AES-256 trước khi lưu.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    Loại lợi nhuận
                  </label>
                  <select
                    value={newProfitType}
                    onChange={(e) => setNewProfitType(e.target.value as any)}
                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold"
                  >
                    <option value="PERCENTAGE">Phần trăm (%)</option>
                    <option value="FIXED">Số tiền cố định (VNĐ)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    Giá trị lợi nhuận (
                    {newProfitType === "PERCENTAGE" ? "%" : "VNĐ"})
                  </label>
                  <Input
                    type="number"
                    value={newProfitValue}
                    onChange={(e) => setNewProfitValue(e.target.value)}
                    placeholder="10"
                    className="h-9 font-bold text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  Ngưỡng cảnh báo số dư vốn thấp (VNĐ)
                </label>
                <Input
                  type="number"
                  value={newAlertThreshold}
                  onChange={(e) => setNewAlertThreshold(e.target.value)}
                  placeholder="50000"
                  className="h-9 font-bold text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
              >
                Hủy
              </Button>
              <Button
                onClick={handleCreateSupplier}
                disabled={actionLoading === "create-supplier"}
              >
                {actionLoading === "create-supplier" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Tạo Nhà Cung Cấp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Balance Alert Settings Dialog */}
      {settingsOpen && (
        <Dialog open={true} onOpenChange={() => setSettingsOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Cài đặt cảnh báo số dư
              </DialogTitle>
              <DialogDescription className="text-xs">
                Áp dụng cho email gửi tới{" "}
                {notifyStatus?.recipients.join(", ") || "ADMIN_ALERT_EMAIL"}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Email nhận cảnh báo
                </label>
                <Input
                  value={recipientsInput}
                  onChange={(e) => setRecipientsInput(e.target.value)}
                  placeholder="admin@digishop.com, ke-toan@digishop.com"
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Nhiều email cách nhau bởi dấu phẩy (tối đa 5). Để trống sẽ
                  dùng biến môi trường{" "}
                  <span className="font-mono">ADMIN_ALERT_EMAIL</span>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Nhắc lại sau mỗi (phút)
                </label>
                <Input
                  type="number"
                  min={alertSettings?.minRepeatMinutes ?? 5}
                  max={alertSettings?.maxRepeatMinutes ?? 20160}
                  value={repeatMinutesInput}
                  onChange={(e) => setRepeatMinutesInput(e.target.value)}
                  className="h-9 text-sm font-bold"
                />
                <p className="text-[11px] text-muted-foreground">
                  = {formatRepeatWindow(Number(repeatMinutesInput))}. Lần đầu
                  khi số dư vừa xuống ngưỡng luôn gửi ngay, sau đó mới tính chu
                  kỳ này.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "15 phút", value: 15 },
                  { label: "1 giờ", value: 60 },
                  { label: "6 giờ", value: 360 },
                  { label: "12 giờ", value: 720 },
                  { label: "1 ngày", value: 1440 },
                  { label: "3 ngày", value: 4320 },
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-semibold"
                    onClick={() => setRepeatMinutesInput(String(preset.value))}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5 border">
                Giới hạn {alertSettings?.minRepeatMinutes ?? 5} –{" "}
                {alertSettings?.maxRepeatMinutes ?? 20160} phút. Hiện tại:{" "}
                {formatRepeatWindow(alertSettings?.repeatMinutes ?? 1440)}.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleSaveAlertSettings}
                disabled={actionLoading === "save-alert-settings"}
              >
                {actionLoading === "save-alert-settings" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lưu cài đặt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
