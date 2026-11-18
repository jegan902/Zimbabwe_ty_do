"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Set once the password was accepted but the account still needs a second factor.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const finishLogin = async (loggedUser: { role?: string } | undefined) => {
    toast.success("Đăng nhập thành công!");
    await refresh();

    const searchParams = new URLSearchParams(window.location.search);
    const next = searchParams.get("next");

    if (next) {
      router.push(next);
    } else if (loggedUser?.role === "ADMIN" || loggedUser?.role === "SUPERADMIN") {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (challenge) {
      const trimmed = code.replace(/\s+/g, "");
      if (trimmed.length < 6) {
        toast.error("Nhập mã 6 chữ số từ ứng dụng xác thực, hoặc mã dự phòng");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/2fa/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge, code: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          // An expired challenge cannot be retried: send the user back to step one.
          throw new Error(
            data.message ||
              (typeof data.error === "object" ? data.error?.message : null) ||
              "Xác thực hai lớp thất bại",
          );
        }
        await finishLogin(data.data?.user);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Xác thực hai lớp thất bại");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      toast.error("Vui lòng điền đầy đủ email và mật khẩu");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (typeof data.error === "object" ? data.error?.message : null) || data.error || "Đăng nhập thất bại");
      }

      // Password accepted, but the account is protected by a second factor.
      if (data.data?.twoFactorRequired && data.data?.challenge) {
        setChallenge(data.data.challenge);
        setPassword("");
        setCode("");
        toast.info("Nhập mã xác thực từ ứng dụng Authenticator để hoàn tất");
        return;
      }

      await finishLogin(data.data?.user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-black">
            {challenge ? "Xác thực hai lớp" : "Đăng nhập tài khoản"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {challenge
              ? `Nhập mã 6 chữ số trong ứng dụng Authenticator cho ${email}`
              : "Truy cập ví và lịch sử đơn hàng của bạn"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {challenge ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Mã xác thực</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456 hoặc ABCDE-12345"
                  className="pl-9 h-10 text-sm tracking-widest"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mất điện thoại? Dùng một trong các mã dự phòng bạn đã lưu khi bật 2FA.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Mật khẩu</label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <Button type="submit" disabled={loading} className="w-full h-10 font-bold shadow-md">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {challenge ? "Xác nhận & Đăng nhập" : "Đăng nhập"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>

          {challenge && (
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setCode("");
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Quay lại bước nhập mật khẩu
            </button>
          )}
        </form>

        {!challenge && (
          <div className="text-center text-xs text-muted-foreground pt-2">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-bold text-primary hover:underline">
              Đăng ký ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

