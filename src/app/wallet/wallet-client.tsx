"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  Wallet,
  QrCode,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

const PRESET_AMOUNTS = [50_000, 100_000, 200_000, 500_000, 1_000_000];

export function WalletClient() {
  const { user, wallet, loading: authLoading, refresh } = useAuth();
  const [amount, setAmount] = useState<number>(100_000);
  const [depositData, setDepositData] = useState<any>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);

  // 5-minute countdown and cancellation states
  const [timeLeft, setTimeLeft] = useState<number>(300); // 300s = 5m
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/wallet/transactions");
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.data?.items || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingTxns(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  // Cancel deposit transaction (can be called automatically on 5-min timeout or manually)
  const handleCancelDeposit = async (isAutoTimeout = false) => {
    if (!depositData || cancelling) return;

    setCancelling(true);
    try {
      await fetch("/api/wallet/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: depositData.transactionId,
          paymentCode: depositData.paymentCode,
          reason: isAutoTimeout
            ? "Quá thời hạn 5 phút (Tự động hủy)"
            : "Người dùng chủ động hủy yêu cầu",
        }),
      });

      if (isAutoTimeout) {
        setIsExpired(true);
        toast.error("Giao dịch nạp tiền đã quá 5 phút và tự động hủy.");
      } else {
        toast.success("Đã hủy yêu cầu nạp tiền");
        setDepositData(null);
        setIsExpired(false);
        setIsVerified(false);
      }
      fetchTransactions();
    } catch {
      if (isAutoTimeout) setIsExpired(true);
    } finally {
      setCancelling(false);
    }
  };

  // 5-minute countdown timer
  useEffect(() => {
    if (!depositData || isExpired || isVerified) return;

    // Calculate initial remaining seconds
    const targetTime = depositData.expiresAt
      ? new Date(depositData.expiresAt).getTime()
      : Date.now() + 5 * 60 * 1000;

    const updateTimer = () => {
      const remainingSec = Math.max(
        0,
        Math.floor((targetTime - Date.now()) / 1000),
      );
      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        setIsExpired(true);
        handleCancelDeposit(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [depositData, isExpired, isVerified]);

  // Real-time polling check for deposit verification
  useEffect(() => {
    if (!depositData || isExpired || isVerified) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/wallet/deposit?code=${depositData.paymentCode}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const txn = data.data?.transaction;

        if (txn?.status === "VERIFIED") {
          setIsVerified(true);
          toast.success("Nạp tiền thành công! Số dư ví đã được cộng.");
          refresh();
          fetchTransactions();
        } else if (txn?.status === "CANCELLED" || txn?.status === "EXPIRED") {
          setIsExpired(true);
        }
      } catch {
        // Ignored in polling
      }
    };

    const pollInterval = setInterval(checkStatus, 3000);
    return () => clearInterval(pollInterval);
  }, [depositData, isExpired, isVerified]);

  const handleCreateDeposit = async () => {
    if (!amount || amount < 10_000) {
      toast.error("Số tiền nạp tối thiểu là 10.000 VNĐ");
      return;
    }

    setCreatingIntent(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || "Không thể tạo yêu cầu nạp tiền",
        );
      }
      setDepositData(data.data);
      setIsExpired(false);
      setIsVerified(false);
      setTimeLeft(300); // 5 minutes
      toast.success("Đã tạo mã QR nạp tiền thành công! Hết hạn sau 5 phút.");
    } catch (err: any) {
      toast.error(err.message || "Lỗi tạo yêu cầu nạp tiền");
    } finally {
      setCreatingIntent(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border p-12 text-center space-y-4 bg-card">
        <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-bold">Vui lòng đăng nhập</h3>
        <p className="text-xs text-muted-foreground">
          Bạn cần đăng nhập để xem thông tin ví và nạp tiền.
        </p>
        <Button asChild>
          <Link href="/login?next=/wallet">Đăng nhập ngay</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Wallet Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
            Số dư khả dụng
          </span>
          <div className="text-3xl font-black text-foreground">
            {Number(wallet?.availableBalance || 0).toLocaleString("vi-VN")}đ
          </div>
          <span className="text-[11px] text-muted-foreground mt-2 block">
            Có thể dùng ngay để mua bất kỳ sản phẩm nào
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground block mb-1">
            Tổng tiền đã nạp
          </span>
          <div className="text-2xl font-bold text-foreground">
            {Number(wallet?.totalDeposits || 0).toLocaleString("vi-VN")}đ
          </div>
          <span className="text-[11px] text-muted-foreground mt-2 block">
            Tổng tiền nạp thành công từ trước đến nay
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground block mb-1">
            Tổng tiền đã chi
          </span>
          <div className="text-2xl font-bold text-foreground">
            {Number(wallet?.totalSpent || 0).toLocaleString("vi-VN")}đ
          </div>
          <span className="text-[11px] text-muted-foreground mt-2 block">
            Tổng giá trị đơn hàng đã mua thành công
          </span>
        </div>
      </div>

      {/* Deposit Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Deposit Form */}
        <div className="md:col-span-5 rounded-2xl border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b pb-3">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base">Tạo yêu cầu nạp tiền QR</h3>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground">
              Chọn nhanh số tiền nạp
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                    amount === val
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {(val / 1000).toLocaleString()}k
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Hoặc nhập số tiền tùy chọn (VNĐ)
              </label>
              <Input
                type="number"
                min={10000}
                step={10000}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Ví dụ: 150000"
                className="h-10 text-sm font-bold"
              />
            </div>

            <Button
              onClick={handleCreateDeposit}
              disabled={creatingIntent || !amount || amount < 10000}
              className="w-full font-bold shadow-md h-10 mt-2"
            >
              {creatingIntent && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Tạo mã QR Chuyển Khoản
            </Button>
          </div>
        </div>

        {/* QR Display Area */}
        <div className="md:col-span-7 rounded-2xl border bg-card p-6 shadow-sm min-h-[350px] flex flex-col justify-center">
          {isVerified ? (
            <div className="text-center py-10 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black text-foreground">
                  Nạp tiền thành công!
                </h4>
                <p className="text-xs text-muted-foreground">
                  Giao dịch{" "}
                  <strong className="font-mono text-primary">
                    {depositData?.paymentCode}
                  </strong>{" "}
                  đã được hệ thống ghi nhận và cộng tiền vào ví.
                </p>
              </div>
              <Button
                onClick={() => {
                  setDepositData(null);
                  setIsVerified(false);
                }}
                className="font-bold text-xs shadow-sm h-9"
              >
                Tạo giao dịch nạp khác
              </Button>
            </div>
          ) : isExpired ? (
            <div className="text-center py-10 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-lg font-black text-destructive">
                  Giao dịch đã quá 5 phút và tự động hủy
                </h4>
                <p className="text-xs text-muted-foreground">
                  Mã QR chuyển khoản{" "}
                  <strong className="font-mono text-foreground">
                    {depositData?.paymentCode}
                  </strong>{" "}
                  đã hết hạn. Vui lòng không tiếp tục chuyển khoản vào mã này để
                  tránh sự cố.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => {
                    setDepositData(null);
                    setIsExpired(false);
                  }}
                  className="font-bold text-xs h-9 shadow-sm gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tạo mã QR nạp tiền mới
                </Button>
              </div>
            </div>
          ) : depositData ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    Quét mã QR chuyển khoản
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Countdown Timer */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-bold border transition-all ${
                      timeLeft <= 60
                        ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    }`}
                    title="Thời gian hiệu lực của mã QR này"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Hết hạn:{" "}
                      <strong className="text-sm">
                        {formatCountdown(timeLeft)}
                      </strong>
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelDeposit(false)}
                    disabled={cancelling}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2"
                  >
                    {cancelling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Hủy yêu cầu
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={refresh}
                    className="h-7 text-xs gap-1 px-2"
                  >
                    <RefreshCw className="h-3 w-3" /> Kiểm tra số dư
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="p-2 border rounded-xl bg-white shrink-0 shadow-sm relative group">
                  <img
                    src={depositData.qrUrl}
                    alt="VietQR"
                    className="w-48 h-48 object-contain"
                  />
                </div>

                <div className="space-y-2 text-xs flex-1 w-full">
                  <div className="rounded-lg bg-muted/50 p-2 border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Ngân hàng
                      </span>
                      <span className="font-bold">
                        MB Bank ({depositData.bankInfo.bankBin})
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-2 border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Số tài khoản
                      </span>
                      <span className="font-bold select-all">
                        {depositData.bankInfo.accountNumber}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copyText(
                          depositData.bankInfo.accountNumber,
                          "số tài khoản",
                        )
                      }
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-2 border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Chủ tài khoản
                      </span>
                      <span className="font-bold uppercase">
                        {depositData.bankInfo.accountName}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                        NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC)
                      </span>
                      <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 select-all">
                        {depositData.paymentCode}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        copyText(
                          depositData.paymentCode,
                          "nội dung chuyển khoản",
                        )
                      }
                      className="h-8 gap-1 text-xs font-bold"
                    >
                      <Copy className="h-3 w-3" /> Sao chép
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-2.5 text-[11px] text-muted-foreground text-center">
                Vui lòng điền <strong>chính xác nội dung chuyển khoản</strong>{" "}
                và chuyển khoản trước khi hết thời gian <strong>5 phút</strong>.
                Hệ thống tự động kiểm tra và cộng tiền sau 5 - 15 giây.
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <QrCode className="mx-auto h-12 w-12 stroke-[1.5] text-muted-foreground/50" />
              <p className="text-xs">
                Chọn số tiền và bấm &quot;Tạo mã QR Chuyển Khoản&quot; để nạp
                tiền
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-base">Lịch sử biến động số dư</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTransactions}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Làm mới
          </Button>
        </div>

        {loadingTxns ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Đang tải lịch sử...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Chưa có giao dịch nào trong ví của bạn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Loại giao dịch</th>
                  <th className="py-2.5 px-3">Số tiền</th>
                  <th className="py-2.5 px-3">Số dư sau</th>
                  <th className="py-2.5 px-3">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((t) => {
                  const isPlus =
                    t.transactionType === "DEPOSIT" ||
                    t.transactionType === "REFUND";
                  return (
                    <tr key={t.id} className="hover:bg-muted/40">
                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {t.transactionType}
                        </Badge>
                      </td>
                      <td
                        className={`py-3 px-3 font-bold whitespace-nowrap ${isPlus ? "text-emerald-600" : "text-foreground"}`}
                      >
                        {isPlus ? "+" : "-"}
                        {Number(t.amount).toLocaleString("vi-VN")}đ
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {Number(t.balanceAfter).toLocaleString("vi-VN")}đ
                      </td>
                      <td className="py-3 px-3 text-muted-foreground max-w-xs truncate">
                        {t.description || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
