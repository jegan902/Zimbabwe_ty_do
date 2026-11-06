"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import {
  LayoutDashboard,
  Truck,
  RefreshCw,
  ShoppingBag,
  ArrowLeft,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-black text-destructive">Không có quyền truy cập</h1>
        <p className="text-xs text-muted-foreground max-w-md">
          Khu vực này chỉ dành cho tài khoản có quyền Quản trị viên (ADMIN). Vui lòng đăng nhập bằng tài khoản quản trị.
        </p>
        <Button asChild>
          <Link href="/login?next=/admin">Đăng nhập tài khoản Admin</Link>
        </Button>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Tổng quan Dashboard", icon: LayoutDashboard },
    { href: "/admin/suppliers", label: "Nhà cung cấp & Vốn", icon: Truck },
    { href: "/admin/sync", label: "Trung tâm đồng bộ", icon: RefreshCw },
    { href: "/admin/orders", label: "Quản lý đơn & Đối soát", icon: ShoppingBag },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 border-r bg-card/60 p-4 space-y-6 shrink-0">
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 bg-muted/20 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

