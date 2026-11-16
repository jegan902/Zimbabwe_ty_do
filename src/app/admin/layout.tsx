"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import {
  LayoutDashboard,
  Truck,
  RefreshCw,
  ShoppingBag,
  Package,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  Mail,
  Zap,
  LogOut,
  UserCheck,
  Users,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, refresh, logout } = useAuth();

  const [adminEmail, setAdminEmail] = useState("admin@digishop.com");
  const [adminPassword, setAdminPassword] = useState("Admin@123456");
  const [submitting, setSubmitting] = useState(false);

  const handleAdminLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const emailToUse = customEmail || adminEmail;
    const passToUse = customPass || adminPassword;

    if (!emailToUse || !passToUse) {
      toast.error("Vui lòng nhập email và mật khẩu quản trị viên");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, password: passToUse }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Đăng nhập quản trị thất bại");
      }

      toast.success("Đăng nhập Quản trị viên thành công!");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in as Admin / SuperAdmin -> Show sleek Admin Login Form
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto ring-8 ring-primary/5">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Hệ Thống Quản Trị</h1>
            <p className="text-xs text-muted-foreground">
              Đăng nhập tài khoản Quản trị viên (ADMIN) để quản lý hệ thống trung gian, số dư nhà cung cấp và đơn hàng.
            </p>
          </div>

          {user && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Bạn đang đăng nhập tài khoản khách hàng:</p>
                <p className="font-mono text-[11px] truncate">{user.email}</p>
                <p className="text-[11px] mt-1 text-muted-foreground">
                  Vui lòng đăng nhập bằng tài khoản Quản trị viên bên dưới để truy cập.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email Quản trị viên</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@digishop.com"
                  className="pl-9 h-10 text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Mật khẩu Quản trị</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 h-10 text-sm font-medium"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-10 font-bold shadow-md">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng nhập Quản trị viên
            </Button>
          </form>

          {/* Quick Admin Login button for testing convenience */}
          <div className="pt-2 border-t space-y-3">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleAdminLogin(undefined, "admin@digishop.com", "Admin@123456")}
              className="w-full h-9 text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              Đăng nhập nhanh với Admin mặc định
            </Button>

            <div className="text-center">
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Quay lại trang bán hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Tổng quan Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Quản lý khách hàng", icon: Users },
    { href: "/admin/deposits", label: "Giao dịch nạp tiền", icon: CreditCard },
    { href: "/admin/orders", label: "Quản lý đơn & Đối soát", icon: ShoppingBag },
    { href: "/admin/products", label: "Quản lý sản phẩm", icon: Package },
    { href: "/admin/suppliers", label: "Nhà cung cấp & Vốn", icon: Truck },
    { href: "/admin/sync", label: "Trung tâm đồng bộ", icon: RefreshCw },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 border-r bg-card/60 p-4 space-y-6 shrink-0 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="font-black text-sm text-primary flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ADMIN PORTAL
            </div>
            <Link
              href="/"
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Về Web
            </Link>
          </div>

          {/* Logged in Admin Profile Card */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                AD
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs truncate">
                    {user.fullName || "Administrator"}
                  </span>
                  <Badge variant="default" className="text-[9px] px-1.5 py-0 bg-primary">
                    {user.role}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-start gap-2 h-9"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất Admin
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 bg-muted/20 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

