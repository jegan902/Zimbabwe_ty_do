"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Eye, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [reconcilingOrder, setReconcilingOrder] = useState<any>(null);
  const [credentialsInput, setCredentialsInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = async (status = statusFilter) => {
    try {
      const url = status === "ALL" ? "/api/admin/orders" : `/api/admin/orders?status=${status}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) {
        setOrders(json.data?.items || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleReconcile = async (action: "FULFILL" | "CANCEL") => {
    if (!reconcilingOrder) return;

    if (action === "FULFILL" && !credentialsInput.trim()) {
      toast.error("Vui lòng nhập tài khoản bàn giao (mỗi dòng 1 tài khoản: user|pass)");
      return;
    }

    setSubmitting(true);
    try {
      const credentials = action === "FULFILL"
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
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
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
          <h1 className="text-2xl font-black">Quản Lý Đơn Hàng & Đối Soát</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi tất cả đơn hàng, xử lý đối soát các đơn treo hoặc mất kết nối nhà cung cấp.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "SUCCESS", "RECONCILIATION", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
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
        {orders.length === 0 ? (
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
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono font-bold">{o.orderCode}</td>
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
                      {o.status === "RECONCILIATION" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setReconcilingOrder(o);
                            setCredentialsInput("");
                            setNoteInput("");
                          }}
                          className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          Đối soát
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reconciliation Dialog */}
      {reconcilingOrder && (
        <Dialog open={true} onOpenChange={() => setReconcilingOrder(null)}>
          <DialogContent className="sm:max-w-lg">
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

