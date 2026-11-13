"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  User,
  Shield,
  Wallet,
  ShoppingBag,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  KeyRound,
  ExternalLink,
  Coins,
  Code2,
} from "lucide-react";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";

  const { user, wallet, loading, refresh, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "wallet">(
    initialTab === "security" ? "security" : initialTab === "wallet" ? "wallet" : "profile"
  );

  // Profile Form state
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
    }
  }, [user]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "security") setActiveTab("security");
    else if (tab === "wallet") setActiveTab("wallet");
  }, [searchParams]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="rounded-2xl border bg-card p-8 max-w-md w-full shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Yêu cầu đăng nhập</h2>
          <p className="text-xs text-muted-foreground">
            Vui lòng đăng nhập để truy cập trang quản lý tài khoản cá nhân.
          </p>
          <Button onClick={() => router.push("/login")} className="w-full font-bold">
            Đăng nhập ngay
          </Button>
        </div>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Cập nhật hồ sơ thất bại");
      }

      await refresh();
      toast.success("Cập nhật thông tin tài khoản thành công!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Vui lòng nhập mật khẩu hiện tại");
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

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Đổi mật khẩu thất bại");
      }

      toast.success("Đổi mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const formatVnd = (val?: string) => {
    if (!val) return "0 đ";
    return Number(val).toLocaleString("vi-VN") + " đ";
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header Profile Banner */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-primary to-emerald-500 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-primary/20">
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{user.fullName || user.email}</h1>
              <span className="rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl border">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Số dư khả dụng</div>
            <div className="text-lg font-black text-emerald-600">
              {formatVnd(wallet?.availableBalance)}
            </div>
          </div>
          <Link href="/wallet">
            <Button size="sm" className="font-bold shadow-sm">
              + Nạp tiền
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Tabs Sidebar */}
        <div className="md:col-span-1 space-y-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "profile"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" /> Thông tin cá nhân
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "security"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" /> Đổi mật khẩu
          </button>

          <button
            onClick={() => setActiveTab("wallet")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "wallet"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Wallet className="h-4 w-4" /> Ví & Giao dịch
          </button>

          <Link
            href="/api-docs"
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-all border border-sky-500/20 bg-sky-500/5 mt-2"
          >
            <div className="flex items-center gap-3">
              <Code2 className="h-4 w-4" />
              <span>Tài liệu API</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>

          <div className="pt-4 border-t mt-4">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="md:col-span-3">
          {activeTab === "profile" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold">Hồ sơ cá nhân</h2>
                <p className="text-xs text-muted-foreground">
                  Quản lý thông tin cá nhân và liên hệ của bạn
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Địa chỉ Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={user.email}
                      disabled
                      className="pl-9 h-10 text-sm bg-muted/40 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Email dùng để nhận OTP bảo mật và thông báo đơn hàng
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Họ và tên</label>
                  <Input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <Button type="submit" disabled={savingProfile} className="font-bold shadow-md">
                  {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold">Đổi mật khẩu</h2>
                <p className="text-xs text-muted-foreground">
                  Bảo vệ tài khoản bằng mật khẩu mạnh kết hợp chữ, số và ký tự đặc biệt
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Mật khẩu mới</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      required
                      placeholder="Tối thiểu 6 ký tự"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      required
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <Button type="submit" disabled={savingPassword} className="font-bold shadow-md">
                    {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cập nhật mật khẩu
                  </Button>

                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Quên mật khẩu hiện tại?
                  </Link>
                </div>
              </form>
            </div>
          )}

          {activeTab === "wallet" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold">Tổng quan tài chính</h2>
                <p className="text-xs text-muted-foreground">
                  Số dư ví và thông số chi tiêu trên hệ thống
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-4 space-y-1 shadow-sm">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-emerald-600" /> Số dư khả dụng
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    {formatVnd(wallet?.availableBalance)}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-1 shadow-sm">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-primary" /> Tổng đã nạp
                  </div>
                  <div className="text-xl font-black text-foreground">
                    {formatVnd(wallet?.totalDeposits)}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-1 shadow-sm">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-amber-500" /> Tổng đã chi tiêu
                  </div>
                  <div className="text-xl font-black text-foreground">
                    {formatVnd(wallet?.totalSpent)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/wallet">
                  <Button className="font-bold shadow-md">
                    <Wallet className="mr-2 h-4 w-4" /> Nạp tiền vào ví
                  </Button>
                </Link>
                <Link href="/orders">
                  <Button variant="outline" className="font-bold">
                    <ShoppingBag className="mr-2 h-4 w-4" /> Xem lịch sử đơn hàng
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
