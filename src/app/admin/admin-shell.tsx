"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  LayoutDashboard,
  Truck,
  RefreshCw,
  ShoppingBag,
  Package,
  ArrowLeft,
  Loader2,
  LogOut,
  Users,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ADMIN_SIDEBAR_COLLAPSED_COOKIE,
  ADMIN_SIDEBAR_COOKIE_MAX_AGE,
} from "@/lib/utils/constants";

export interface AdminShellUser {
  fullName: string | null;
  email: string;
  role: string;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Quản lý khách hàng", icon: Users },
  { href: "/admin/deposits", label: "Giao dịch nạp tiền", icon: CreditCard },
  { href: "/admin/orders", label: "Quản lý đơn & Đối soát", icon: ShoppingBag },
  { href: "/admin/products", label: "Quản lý sản phẩm", icon: Package },
  { href: "/admin/suppliers", label: "Nhà cung cấp & Vốn", icon: Truck },
  { href: "/admin/sync", label: "Trung tâm đồng bộ", icon: RefreshCw },
  { href: "/admin/security", label: "Bảo mật tài khoản", icon: ShieldCheck },
];

/**
 * Chrome of the admin portal. The identity shown here comes from the server
 * layout (already authorised), not from the client auth context, so a stale
 * `/api/auth/me` response can never render an admin shell for a normal user.
 */
export function AdminShell({
  user,
  twoFactorEnabled,
  twoFactorRequired,
  defaultCollapsed = false,
  children,
}: {
  user: AdminShellUser;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { loading, logout } = useAuth();
  const needsEnrollment = twoFactorRequired && !twoFactorEnabled;

  // Collapse only affects the desktop rail; on mobile the sidebar stays full width.
  // The initial value comes from the server (cookie) so the first paint is already
  // correct and no post-mount state sync is needed.
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      // Persist for the next full page load; the shell itself survives client navigation.
      document.cookie = `${ADMIN_SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/admin; max-age=${ADMIN_SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  };

  const collapseLabel = collapsed
    ? "Mở rộng thanh điều hướng"
    : "Thu gọn thanh điều hướng";

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      {/* Admin Sidebar */}
      <aside
        className={cn(
          "w-full border-r bg-card/60 p-4 space-y-6 shrink-0 flex flex-col justify-between transition-[width,padding] duration-200",
          collapsed ? "md:w-[76px] md:px-2" : "md:w-64",
        )}
      >
        <div className="space-y-6">
          <div
            className={cn(
              "flex items-center justify-between gap-2 border-b pb-3",
              collapsed && "md:justify-center",
            )}
          >
            <div
              className={cn(
                "font-black text-sm text-primary flex items-center gap-1.5",
                collapsed && "md:hidden",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ADMIN PORTAL
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                title="Về Web"
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                <span className={cn(collapsed && "md:hidden")}>Về Web</span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={toggleCollapsed}
                title={collapseLabel}
                aria-label={collapseLabel}
                aria-expanded={!collapsed}
                aria-controls="admin-sidebar-nav"
                className="hidden md:inline-flex text-muted-foreground hover:text-foreground"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Logged in Admin Profile Card */}
          <div
            className={cn(
              "rounded-xl border bg-muted/30 p-3 space-y-2",
              collapsed && "md:p-2",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2.5",
                collapsed && "md:justify-center",
              )}
            >
              <div
                className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs"
                title={user.fullName || "Administrator"}
              >
                AD
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs truncate">
                    {user.fullName || "Administrator"}
                  </span>
                  <Badge
                    variant="default"
                    className="text-[9px] px-1.5 py-0 bg-primary"
                  >
                    {user.role}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <nav id="admin-sidebar-nav" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                    collapsed && "md:justify-center md:px-0",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "md:hidden")}>
                    {item.label}
                  </span>
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
            disabled={loading}
            title="Đăng xuất Admin"
            className={cn(
              "w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-start gap-2 h-9",
              collapsed && "md:justify-center md:px-0",
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            <span className={cn(collapsed && "md:hidden")}>
              Đăng xuất Admin
            </span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 bg-muted/20 overflow-y-auto">
        {needsEnrollment && pathname !== "/admin/security" && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">
                Tài khoản quản trị chưa bật xác thực hai lớp (2FA)
              </p>
              <p>
                Mọi thao tác quản trị đang bị chặn để bảo vệ shop. Hãy bật 2FA
                bằng ứng dụng Google Authenticator / Authy — chỉ mất khoảng 1
                phút.{" "}
                <Link href="/admin/security" className="font-bold underline">
                  Bật ngay
                </Link>
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
