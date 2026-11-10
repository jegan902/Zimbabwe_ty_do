"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, Lock, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"REQUEST_OTP" | "RESET_PASSWORD">("REQUEST_OTP");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }

    setLoading(true);
    setDevOtp(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Không thể gửi mã xác thực");
      }

      toast.success(data.data?.message || "Mã OTP đã được gửi về email!");
      if (data.data?.devOtp) {
        setDevOtp(data.data.devOtp);
        setOtp(data.data.devOtp);
      }
      setStep("RESET_PASSWORD");
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Vui lòng nhập đủ 6 chữ số mã OTP");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không khớp");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          token: otp,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Đặt lại mật khẩu thất bại");
      }

      toast.success("Mật khẩu đã được đặt lại thành công! Đang chuyển hướng...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black">
            {step === "REQUEST_OTP" ? "Quên mật khẩu?" : "Đặt lại mật khẩu"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {step === "REQUEST_OTP"
              ? "Nhập email của bạn để nhận mã xác thực OTP khôi phục tài khoản"
              : `Nhập mã 6 số gửi đến ${email} và mật khẩu mới của bạn`}
          </p>
        </div>

        {devOtp && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-1 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Môi trường thử nghiệm: </span>
              Hệ thống chưa cấu hình SMTP mail thật nên mã OTP tự động là{" "}
              <span className="font-mono font-black text-sm px-1.5 py-0.5 bg-background rounded border border-amber-500/40 text-primary">
                {devOtp}
              </span>
            </div>
          </div>
        )}

        {step === "REQUEST_OTP" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email đăng ký</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="pl-9 h-10 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 font-bold shadow-md">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gửi mã xác thực OTP
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">Mã xác thực OTP (6 số)</label>
                <button
                  type="button"
                  onClick={() => setStep("REQUEST_OTP")}
                  className="text-xs text-primary hover:underline"
                >
                  Đổi email
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="pl-9 h-10 text-sm font-mono tracking-widest text-center text-base"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 font-bold shadow-md">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận & Đặt lại mật khẩu
            </Button>

            <div className="text-center">
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={() => handleRequestOtp()}
                className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Gửi lại mã OTP sau ${resendCooldown}s`
                  : "Chưa nhận được mã? Gửi lại OTP"}
              </button>
            </div>
          </form>
        )}

        <div className="pt-2 border-t text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
