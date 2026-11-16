"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  Copy,
  Clock,
  User,
  Package,
  Truck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Reconciliation Dialog State
  const [reconcilingOrder, setReconcilingOrder] = useState<any>(null);
  const [credentialsInput, setCredentialsInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // View Detail Dialog State
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete Dialog State
  const [deletingOrder, setDeletingOrder] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchOrders = async (targetPage = page, targetStatus = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: "15",
        status: targetStatus,
      });
      if (search.trim()) {
        params.append("search", search.trim());
      }

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setOrders(json.data?.items || []);
        setTotalPages(json.data?.totalPages || 1);
      }
    } catch {
      toast.error("Không thể tải danh sách đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(page, statusFilter);
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(1, statusFilter);
  };

  const openOrderDetail = async (orderId: string) => {
    setViewingOrderId(orderId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const json = await res.json();
      if (res.ok) {
        setOrderDetail(json.data?.order);
      } else {
        toast.error(json.error?.message || "Không thể tải chi tiết đơn hàng");
      }
    } catch {
      toast.error("Lỗi khi tải chi tiết đơn hàng");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${deletingOrder.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Xóa đơn hàng thất bại");

      toast.success(json.data?.message || "Đã xóa đơn hàng thành công!");
      setDeletingOrder(null);
      fetchOrders(page, statusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReconcile = async (action: "FULFILL" | "CANCEL") => {
    if (!reconcilingOrder) return;

    if (action === "FULFILL" && !credentialsInput.trim()) {
      toast.error("Vui lòng nhập tài khoản bàn giao (mỗi dòng 1 tài khoản: user|pass)");
      return;
    }

    setSubmitting(true);
    try {
      const credentials =
        action === "FULFILL"
          ? credentialsInput.split("\n").map((s) => s.trim()).filter(Boolean)
          : undefined;

      const res = await fetch(`/api/admin/orders/${reconcilingOrder.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          credentials,
          note: noteInput || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Đối soát thất bại");

      toast.success(json.data?.message || "Xử lý đối soát thành công!");
      setReconcilingOrder(null);
      setCredentialsInput("");
      setNoteInput("");
      fetchOrders(page, statusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép vào bộ nhớ tạm!");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Quản Lý Đơn Hàng & Đối Soát</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi tất cả đơn hàng, xem chi tiết tài khoản bàn giao, xóa đơn hoặc xử lý đối soát.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchOrders(page, statusFilter)}
          disabled={loading}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn (ví dụ ORD-...), email khách, sản phẩm..."
            className="pl-9 h-9 text-xs"
          />
        </form>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "SUCCESS", "RECONCILIATION", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st === "ALL"
                ? "Tất cả"
                : st === "SUCCESS"
                ? "Thành công"
                : st === "RECONCILIATION"
                ? "Cần đối soát"
                : "Thất bại"}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Mã đơn</th>
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Sản phẩm</th>
                  <th className="py-3 px-4">Số lượng</th>
                  <th className="py-3 px-4">Giá bán</th>
                  <th className="py-3 px-4">Giá nhập</th>
                  <th className="py-3 px-4">Lợi nhuận</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">{o.orderCode}</td>
                    <td className="py-3 px-4 text-muted-foreground">{o.customerEmail}</td>
                    <td className="py-3 px-4 font-medium max-w-xs truncate">{o.productName}</td>
                    <td className="py-3 px-4 font-semibold">{o.quantity}</td>
                    <td className="py-3 px-4 font-bold">
                      {Number(o.totalAmount).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {Number(o.supplierCost).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">
                      +{Number(o.profit).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          o.status === "SUCCESS"
                            ? "default"
                            : o.status === "RECONCILIATION"
                            ? "secondary"
                            : "outline"
                        }
                        className={`text-[10px] ${
                          o.status === "RECONCILIATION"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border-amber-500/30"
                            : ""
                        }`}
                      >
                        {o.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Detail Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openOrderDetail(o.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Xem chi tiết đơn hàng"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        {/* Reconciliation Button if applicable */}
                        {o.status === "RECONCILIATION" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setReconcilingOrder(o);
                              setCredentialsInput("");
                              setNoteInput("");
                            }}
                            className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5"
                          >
                            Đối soát
                          </Button>
                        )}

                        {/* Delete Order Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingOrder(o)}
                          className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Xóa đơn hàng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 text-xs"
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 text-xs"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Order View Detail Dialog */}
      {viewingOrderId && (
        <Dialog open={true} onOpenChange={() => setViewingOrderId(null)}>
          <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span>Chi tiết đơn hàng: {orderDetail?.orderCode || "..."}</span>
                {orderDetail?.status && (
                  <Badge variant={orderDetail.status === "SUCCESS" ? "default" : "outline"} className="text-xs">
                    {orderDetail.status}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Xem toàn bộ thông tin đơn hàng, tài khoản bàn giao, dữ liệu nhà cung cấp và lịch sử chuyển trạng thái.
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !orderDetail ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Không tìm thấy đơn hàng</div>
            ) : (
              <div className="space-y-4 py-2 text-xs">
                {/* Product & Financial Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <span className="text-[10px] text-muted-foreground block">Sản phẩm</span>
                    <span className="font-bold text-xs truncate block mt-0.5" title={orderDetail.product.name}>
                      {orderDetail.product.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Số lượng: x{orderDetail.quantity}</span>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <span className="text-[10px] text-muted-foreground block">Tổng thanh toán</span>
                    <span className="font-black text-sm text-foreground block mt-0.5">
                      {Number(orderDetail.totalAmount).toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-[10px] text-muted-foreground">Đơn giá: {Number(orderDetail.sellingPrice).toLocaleString("vi-VN")}đ</span>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <span className="text-[10px] text-muted-foreground block">Giá nhập NCC</span>
                    <span className="font-mono font-bold text-xs text-muted-foreground block mt-0.5">
                      {Number(orderDetail.supplierCost).toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-[10px] text-muted-foreground">Tổng vốn: {Number(orderDetail.totalCost).toLocaleString("vi-VN")}đ</span>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <span className="text-[10px] text-muted-foreground block">Lợi nhuận ròng</span>
                    <span className="font-black text-sm text-emerald-600 block mt-0.5">
                      +{Number(orderDetail.profit).toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Giao dịch đã chốt</span>
                  </div>
                </div>

                {/* Customer and Supplier Info */}
                <div className="rounded-xl border p-3.5 bg-card space-y-2 text-xs">
                  <div className="font-bold border-b pb-1.5 flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" />
                    Thông tin khách hàng & Đối tác nhà cung cấp
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Khách hàng: </span>
                      <strong className="text-foreground">{orderDetail.user?.fullName || "Chưa cập nhật"}</strong>
                      <span className="block text-muted-foreground font-mono text-[11px] mt-0.5">{orderDetail.user?.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nhà cung cấp: </span>
                      <strong className="text-primary">{orderDetail.supplierName}</strong>
                      {orderDetail.supplierTransId && (
                        <span className="block text-muted-foreground font-mono text-[11px] mt-0.5">
                          Mã giao dịch NCC: {orderDetail.supplierTransId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivered Credentials (Full width, breakdown & copy) */}
                <div className="rounded-2xl border p-4 bg-muted/20 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="font-bold text-sm text-foreground">
                        Tài khoản / Dữ liệu đã bàn giao ({orderDetail.credentials?.length || 0})
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-background">
                        Mã hóa an toàn
                      </Badge>
                    </div>
                    {orderDetail.credentials?.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            orderDetail.credentials.map((c: any) => c.data).join("\n")
                          )
                        }
                        className="h-7 text-xs font-bold gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Sao chép tất cả tài khoản
                      </Button>
                    )}
                  </div>

                  {orderDetail.credentials?.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Chưa có tài khoản nào được bàn giao cho đơn hàng này.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {orderDetail.credentials.map((c: any) => {
                        const parts = c.data ? c.data.split("|") : [];
                        return (
                          <div
                            key={c.id}
                            className="rounded-xl bg-background border p-3.5 space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="font-mono text-[11px] font-bold">
                                Tài khoản #{c.position}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(c.data)}
                                className="h-7 text-xs font-semibold gap-1.5 text-foreground hover:text-primary"
                              >
                                <Copy className="h-3 w-3" />
                                Sao chép chuỗi này
                              </Button>
                            </div>

                            {/* Multi-part helper chips if separated by | */}
                            {parts.length > 1 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 pb-1">
                                {parts.map((p: string, idx: number) => {
                                  const label =
                                    idx === 0
                                      ? "Tài khoản / UID"
                                      : idx === 1
                                      ? "Mật khẩu"
                                      : idx === 2
                                      ? "2FA / Mã bảo mật"
                                      : idx === 3
                                      ? "Cookie / Session"
                                      : `Trường #${idx + 1}`;
                                  return (
                                    <div
                                      key={idx}
                                      className="rounded-lg bg-muted/40 p-2.5 border text-xs flex flex-col justify-between space-y-1"
                                    >
                                      <span className="text-[10px] text-muted-foreground font-medium">
                                        {label}
                                      </span>
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-mono font-bold break-all text-foreground select-all text-xs">
                                          {p || "(trống)"}
                                        </span>
                                        {p && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(p)}
                                            className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                                            title={`Sao chép ${label}`}
                                          >
                                            <Copy className="h-2.5 w-2.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Full raw string box without truncation */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                Chuỗi dữ liệu đầy đủ:
                              </span>
                              <pre className="p-3 rounded-lg bg-muted/50 border font-mono text-xs break-all whitespace-pre-wrap leading-relaxed select-all text-foreground">
                                {c.data}
                              </pre>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reconciliation Note & Errors */}
                {(orderDetail.reconciliationNote || orderDetail.errorDetails) && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs space-y-1">
                    <span className="font-bold text-amber-700 dark:text-amber-400 block">
                      Ghi chú đối soát & Chi tiết lỗi:
                    </span>
                    {orderDetail.reconciliationNote && (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {orderDetail.reconciliationNote}
                      </p>
                    )}
                    {orderDetail.errorDetails && (
                      <p className="text-[11px] font-mono text-rose-600 break-all">
                        {orderDetail.errorDetails}
                      </p>
                    )}
                  </div>
                )}

                {/* Status Timeline */}
                {orderDetail.statusHistories?.length > 0 && (
                  <div className="rounded-xl border p-3.5 space-y-2">
                    <span className="font-bold text-xs block border-b pb-1.5">Lịch sử trạng thái đơn</span>
                    <div className="space-y-2 max-h-36 overflow-y-auto text-xs">
                      {orderDetail.statusHistories.map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between text-muted-foreground">
                          <div>
                            <Badge variant="outline" className="text-[10px] mr-2 font-mono">
                              {h.statusTo}
                            </Badge>
                            <span>{h.reason || "Cập nhật hệ thống"}</span>
                          </div>
                          <span className="text-[11px] whitespace-nowrap">
                            {new Date(h.changedAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setViewingOrderId(null)} className="text-xs">
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingOrder && (
        <Dialog open={true} onOpenChange={() => setDeletingOrder(null)}>
          <DialogContent className="sm:max-w-lg w-[90vw]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Xác nhận xóa đơn hàng: {deletingOrder.orderCode}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Thao tác này sẽ xóa vĩnh viễn đơn hàng cùng các thông tin bàn giao và lịch sử liên quan khỏi hệ thống. Nếu đơn đang giữ tiền ví, số tiền sẽ được tự động giải phóng lại cho khách hàng.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-xs space-y-2">
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-rose-700 dark:text-rose-400">
                <div>Khách hàng: <strong>{deletingOrder.customerEmail}</strong></div>
                <div>Sản phẩm: <strong>{deletingOrder.productName}</strong></div>
                <div>Tổng tiền: <strong>{Number(deletingOrder.totalAmount).toLocaleString("vi-VN")}đ</strong></div>
                <div>Trạng thái hiện tại: <strong>{deletingOrder.status}</strong></div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingOrder(null)}
                disabled={isDeleting}
                className="text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteOrder}
                disabled={isDeleting}
                className="text-xs font-bold"
              >
                {isDeleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Xác nhận Xóa đơn hàng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reconciliation Dialog */}
      {reconcilingOrder && (
        <Dialog open={true} onOpenChange={() => setReconcilingOrder(null)}>
          <DialogContent className="sm:max-w-2xl w-[92vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Đối soát đơn hàng: {reconcilingOrder.orderCode}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Đơn hàng này chưa nhận được phản hồi rõ ràng từ nhà cung cấp (timeout hoặc lỗi mạng). Tiền của khách hàng hiện vẫn đang được GIỮ (Reserved) trong ví.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl bg-muted/50 p-3 border space-y-1">
                <div>Khách hàng: <span className="font-semibold">{reconcilingOrder.customerEmail}</span></div>
                <div>Sản phẩm: <span className="font-semibold">{reconcilingOrder.productName}</span></div>
                <div>Tổng tiền đang giữ: <span className="font-black text-primary">{Number(reconcilingOrder.totalAmount).toLocaleString("vi-VN")}đ</span></div>
                {reconcilingOrder.reconciliationNote && (
                  <div className="text-amber-600 font-mono text-[11px] pt-1">
                    Lý do treo: {reconcilingOrder.reconciliationNote}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">
                  Tài khoản bàn giao (Nếu kiểm tra thấy nhà cung cấp đã trừ tiền & trả tài khoản):
                </label>
                <Textarea
                  rows={3}
                  value={credentialsInput}
                  onChange={(e) => setCredentialsInput(e.target.value)}
                  placeholder="user1|pass1&#10;user2|pass2"
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground">Mỗi dòng 1 tài khoản. Định dạng: username|password</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">Ghi chú đối soát:</label>
                <Input
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Ví dụ: Đã đối soát trên portal nhà cung cấp và xác nhận thành công"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={() => handleReconcile("CANCEL")}
                disabled={submitting}
                className="text-xs font-bold"
              >
                Hủy đơn & Hoàn lại tiền cho khách
              </Button>
              <Button
                variant="default"
                onClick={() => handleReconcile("FULFILL")}
                disabled={submitting}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Chốt tiền & Giao tài khoản
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
