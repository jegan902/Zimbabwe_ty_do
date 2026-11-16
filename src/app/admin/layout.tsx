"use client";

import Link from "next/link";
import { notFound, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import NotFound from "@/app/not-found";
import {
  LayoutDashboard,
  Truck,
  RefreshCw,
  ShoppingBag,
  Package,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  LogOut,
  UserCheck,
  Users,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Nếu không phải ADMIN hoặc SUPERADMIN -> trả về trang 404 Not Found
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
    notFound();
    return <NotFound />;
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

