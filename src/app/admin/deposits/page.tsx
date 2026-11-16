"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  Loader2,
  Copy,
  DollarSign,
  TrendingUp,
  QrCode,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtersRef = useRef({
    page: 1,
    statusFilter: "ALL",
    search: "",
  });

  useEffect(() => {
    filtersRef.current = {
      page,
      statusFilter,
      search,
    };
  }, [page, statusFilter, search]);

  // View Detail State
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);

  // Manual Verify Dialog State
  const [verifyingDeposit, setVerifyingDeposit] = useState<any>(null);
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const [verifyNoteInput, setVerifyNoteInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Cancel Dialog State
  const [cancellingDeposit, setCancellingDeposit] = useState<any>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchDeposits = useCallback(
    async (options?: {
      silent?: boolean;
      filters?: Partial<typeof filtersRef.current>;
    }) => {
      const silent = options?.silent ?? false;
      const activeFilters = {
        ...filtersRef.current,
        ...(options?.filters || {}),
      };

      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams({
          page: activeFilters.page.toString(),
          limit: "15",
          status: activeFilters.statusFilter,
        });
        if (activeFilters.search.trim()) {
          params.append("search", activeFilters.search.trim());
        }

        const res = await fetch(`/api/admin/deposits?${params.toString()}`);
        const json = await res.json();
        if (res.ok) {
          setDeposits(json.data?.items || []);
          setSummary(json.data?.summary || {});
          setTotalPages(json.data?.pagination?.totalPages || 1);
        } else {
          toast.error(json.error?.message || "Không thể tải danh sách nạp tiền");
        }
      } catch {
        toast.error("Lỗi khi tải danh sách giao dịch");
      } finally {
        if (!silent) {
          setLoading(false);
        }
        setIsRefreshing(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  // Realtime SSE listener for deposit/wallet updates without losing filters and without flickering table
  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "wallet.updated") {
          fetchDeposits({ silent: true });
          toast.info("Đã cập nhật danh sách nạp tiền thời gian thực!", {
            id: "realtime-deposits",
            duration: 2500,
          });
        }
      } catch {}
    };
    return () => source.close();
  }, [fetchDeposits]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDeposits({ filters: { page: 1, search } });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép vào bộ nhớ tạm!");
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingDeposit) return;

    const amountNum = receivedAmountInput
      ? parseFloat(receivedAmountInput.replace(/,/g, ""))
      : undefined;

    setIsVerifying(true);
    try {
      const res = await fetch(`/api/admin/deposits/${verifyingDeposit.id}/manual-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedAmount: amountNum,
          note: verifyNoteInput.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Duyệt nạp tiền thất bại");

      toast.success(json.data?.message || "Duyệt nạp tiền thành công, đã cộng tiền vào ví khách!");
      setVerifyingDeposit(null);
      setReceivedAmountInput("");
      setVerifyNoteInput("");
      fetchDeposits({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingDeposit) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/admin/deposits/${cancellingDeposit.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReasonInput.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Hủy giao dịch thất bại");

      toast.success(json.data?.message || "Đã hủy giao dịch nạp tiền thành công!");
      setCancellingDeposit(null);
      setCancelReasonInput("");
      fetchDeposits({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black">Quản Lý Giao Dịch Nạp Tiền</h1>
            {isRefreshing && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 animate-pulse gap-1 py-0.5 px-2">
                <RefreshCw className="h-3 w-3 animate-spin" /> Đang cập nhật live...
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi tất cả giao dịch nạp tiền qua VietQR / SePay, tra cứu và duyệt nạp thủ công khi cần thiết.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDeposits({ silent: true })}
          disabled={loading || isRefreshing}
          className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading || isRefreshing ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Tổng nạp thành công</span>
            <span className="text-2xl font-black text-emerald-600">
              {Number(summary.totalVerifiedAmount || 0).toLocaleString("vi-VN")}đ
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {summary.totalVerifiedCount || 0} giao dịch
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Nạp thành công hôm nay</span>
            <span className="text-2xl font-black text-primary">
              {Number(summary.todayVerifiedAmount || 0).toLocaleString("vi-VN")}đ
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {summary.todayVerifiedCount || 0} giao dịch hôm nay
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Giao dịch đang chờ</span>
            <span className="text-2xl font-black text-amber-600">
              {summary.pendingCount || 0}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Chờ thanh toán / xác nhận
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Cổng thanh toán chính</span>
            <span className="text-xl font-black text-foreground">
              VietQR / SePay
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
              Tự động cộng ví 24/7
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-muted text-foreground flex items-center justify-center font-bold">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã nạp (NAPxxxxxx), email khách, mã giao dịch SePay..."
            className="pl-9 pr-8 h-9 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
                fetchDeposits({ filters: { page: 1, search: "" } });
              }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer text-xs"
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </form>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "VERIFIED", "PENDING", "CANCELLED", "EXPIRED"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
                fetchDeposits({ filters: { page: 1, statusFilter: st } });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st === "ALL"
                ? "Tất cả"
                : st === "VERIFIED"
                ? "Thành công"
                : st === "PENDING"
                ? "Đang chờ"
                : st === "CANCELLED"
                ? "Đã hủy"
                : "Hết hạn"}
            </button>
          ))}
        </div>
      </div>

      {/* Deposits Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {loading && deposits.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : deposits.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Không tìm thấy giao dịch nạp tiền nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Mã nạp</th>
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Số tiền nạp</th>
                  <th className="py-3 px-4">Thực nhận</th>
                  <th className="py-3 px-4">Cổng</th>
                  <th className="py-3 px-4">Mã GD SePay</th>
                  <th className="py-3 px-4">Thời gian tạo</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-1">
                        <span>{d.paymentCode}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(d.paymentCode)}
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{d.customerEmail}</div>
                      <div className="text-[10px] text-muted-foreground">{d.customerName}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {Number(d.amount).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-600">
                      {d.receivedAmount
                        ? `${Number(d.receivedAmount).toLocaleString("vi-VN")}đ`
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {d.gateway}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                      {d.gatewayTxnId || "-"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          d.status === "VERIFIED"
                            ? "default"
                            : d.status === "PENDING"
                            ? "secondary"
                            : "outline"
                        }
                        className={`text-[10px] ${
                          d.status === "VERIFIED"
                            ? "bg-emerald-500/15 text-emerald-600 font-bold border-emerald-500/30"
                            : d.status === "PENDING"
                            ? "bg-amber-500/15 text-amber-600 font-bold border-amber-500/30"
                            : ""
                        }`}
                      >
                        {d.status === "VERIFIED"
                          ? "Thành công"
                          : d.status === "PENDING"
                          ? "Đang chờ"
                          : d.status === "CANCELLED"
                          ? "Đã hủy"
                          : d.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Detail Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDeposit(d)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Xem chi tiết giao dịch"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        {/* Manual Verify Button (if PENDING) */}
                        {d.status === "PENDING" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setVerifyingDeposit(d);
                              setReceivedAmountInput(d.amount);
                              setVerifyNoteInput("");
                            }}
                            className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                            title="Duyệt nạp thủ công"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Duyệt nạp
                          </Button>
                        )}

                        {/* Cancel Button (if PENDING) */}
                        {d.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCancellingDeposit(d);
                              setCancelReasonInput("");
                            }}
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Hủy giao dịch"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  fetchDeposits({ filters: { page: newPage } });
                }}
                disabled={page <= 1}
                className="h-7 text-xs cursor-pointer"
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = Math.min(totalPages, page + 1);
                  setPage(newPage);
                  fetchDeposits({ filters: { page: newPage } });
                }}
                disabled={page >= totalPages}
                className="h-7 text-xs cursor-pointer"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Deposit Detail Dialog */}
      {selectedDeposit && (
        <Dialog open={true} onOpenChange={() => setSelectedDeposit(null)}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span>Chi tiết nạp tiền: {selectedDeposit.paymentCode}</span>
                <Badge
                  variant={selectedDeposit.status === "VERIFIED" ? "default" : "outline"}
                  className="text-xs"
                >
                  {selectedDeposit.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Xem chi tiết thông tin thanh toán, thời gian nhận tiền và dữ liệu cổng giao dịch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khách hàng:</span>
                  <strong className="text-foreground">{selectedDeposit.customerEmail}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Họ tên:</span>
                  <span>{selectedDeposit.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mã nội dung nạp:</span>
                  <span className="font-mono font-bold text-primary">{selectedDeposit.paymentCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Số tiền yêu cầu:</span>
                  <span className="font-bold">{Number(selectedDeposit.amount).toLocaleString("vi-VN")}đ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Số tiền thực nhận:</span>
                  <span className="font-black text-emerald-600 text-sm">
                    {selectedDeposit.receivedAmount
                      ? `${Number(selectedDeposit.receivedAmount).toLocaleString("vi-VN")}đ`
                      : "Chưa ghi nhận"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl border p-2.5 space-y-1">
                  <span className="text-muted-foreground block text-[10px]">Cổng thanh toán</span>
                  <span className="font-bold block">{selectedDeposit.gateway} ({selectedDeposit.paymentMethod})</span>
                  <span className="text-muted-foreground block font-mono text-[10px] truncate">
                    Mã GD: {selectedDeposit.gatewayTxnId || "Chưa có"}
                  </span>
                </div>

                <div className="rounded-xl border p-2.5 space-y-1">
                  <span className="text-muted-foreground block text-[10px]">Thời gian</span>
                  <span className="text-muted-foreground block text-[10px]">Tạo: {new Date(selectedDeposit.createdAt).toLocaleString("vi-VN")}</span>
                  {selectedDeposit.verifiedAt && (
                    <span className="text-emerald-600 font-semibold block text-[10px]">
                      Duyệt: {new Date(selectedDeposit.verifiedAt).toLocaleString("vi-VN")}
                    </span>
                  )}
                </div>
              </div>

              {selectedDeposit.gatewayResponse && (
                <div className="rounded-xl border p-2.5 bg-background space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground block">
                    Dữ liệu phản hồi / Ghi chú duyệt:
                  </span>
                  <pre className="text-[10px] font-mono bg-muted/40 p-2 rounded-lg max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {selectedDeposit.gatewayResponse}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedDeposit(null)} className="text-xs">
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Verify Dialog */}
      {verifyingDeposit && (
        <Dialog open={true} onOpenChange={() => setVerifyingDeposit(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                Duyệt Nạp Tiền Thủ Công: {verifyingDeposit.paymentCode}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sử dụng khi khách hàng đã chuyển tiền vào tài khoản ngân hàng nhưng hệ thống chưa tự động cộng ví (do lỗi mạng hoặc khách ghi sai nội dung).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleManualVerify} className="space-y-3.5 py-2 text-xs">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
                <div>Khách hàng: <strong>{verifyingDeposit.customerEmail}</strong></div>
                <div>Mã nội dung: <strong className="font-mono">{verifyingDeposit.paymentCode}</strong></div>
                <div>Số tiền yêu cầu: <strong className="text-primary">{Number(verifyingDeposit.amount).toLocaleString("vi-VN")}đ</strong></div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">
                  Số tiền thực nhận theo sao kê ngân hàng (VNĐ):
                </label>
                <Input
                  type="number"
                  min="1000"
                  step="1000"
                  value={receivedAmountInput}
                  onChange={(e) => setReceivedAmountInput(e.target.value)}
                  placeholder="Nhập số tiền thực nhận"
                  required
                  className="h-9 text-sm font-bold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Ghi chú đối soát (Tùy chọn):</label>
                <Input
                  value={verifyNoteInput}
                  onChange={(e) => setVerifyNoteInput(e.target.value)}
                  placeholder="Ví dụ: Đã kiểm tra sao kê ngân hàng VCB lúc 12:30"
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVerifyingDeposit(null)}
                  disabled={isVerifying}
                  className="text-xs"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isVerifying}
                  size="sm"
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isVerifying && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Xác nhận Duyệt & Cộng Tiền Ví
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Deposit Dialog */}
      {cancellingDeposit && (
        <Dialog open={true} onOpenChange={() => setCancellingDeposit(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Hủy Yêu Cầu Nạp Tiền: {cancellingDeposit.paymentCode}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Hủy giao dịch nạp tiền đang chờ (PENDING) khi khách hàng không chuyển khoản hoặc giao dịch đã quá hạn.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCancelDeposit} className="space-y-3.5 py-2 text-xs">
              <div className="rounded-xl bg-muted/40 border p-3 space-y-1">
                <div>Khách hàng: <strong>{cancellingDeposit.customerEmail}</strong></div>
                <div>Số tiền: <strong>{Number(cancellingDeposit.amount).toLocaleString("vi-VN")}đ</strong></div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Lý do hủy (Tùy chọn):</label>
                <Input
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Ví dụ: Khách hàng tạo nhầm đơn nạp, quá hạn 24h..."
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancellingDeposit(null)}
                  disabled={isCancelling}
                  className="text-xs"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isCancelling}
                  size="sm"
                  className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isCancelling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Xác nhận Hủy giao dịch
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
