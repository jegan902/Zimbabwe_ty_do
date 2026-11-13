"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Wallet,
  ShoppingBag,
  ShieldCheck,
  LogOut,
  User,
  PlusCircle,
  Menu,
  Lock,
  Code2,
} from "lucide-react";
import { useState } from "react";

export function Header() {
  const { user, wallet, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatMoney = (val?: string) => {
    if (!val) return "0đ";
    return `${Number(val).toLocaleString("vi-VN")}đ`;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-lg shadow-sm">
              DS
            </span>
            <span>DIGISHOP<span className="text-xs font-normal text-muted-foreground ml-1.5 px-1.5 py-0.5 rounded bg-muted">AUTO</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="transition-colors hover:text-primary">
              Trang chủ
            </Link>
            <Link href="/products" className="transition-colors hover:text-primary">
              Sản phẩm
            </Link>
            <Link href="/wallet" className="transition-colors hover:text-primary">
              Nạp tiền
            </Link>
            <Link href="/orders" className="transition-colors hover:text-primary">
              Đơn hàng
            </Link>
            <Link href="/api-docs" className="transition-colors hover:text-primary font-semibold text-sky-600 dark:text-sky-400">
              Tài liệu API
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/wallet"
                className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>Ví: {formatMoney(wallet?.availableBalance)}</span>
                <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] text-white">
                  + Nạp
                </span>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border p-1.5 px-3 text-sm font-medium hover:bg-accent transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    {user.email[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline max-w-[120px] truncate text-xs">
                    {user.email.split("@")[0]}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="font-medium text-xs text-muted-foreground">Tài khoản</div>
                    <div className="truncate text-sm font-semibold">{user.email}</div>
                    <div className="mt-1 text-xs text-emerald-600 font-bold">
                      Số dư: {formatMoney(wallet?.availableBalance)}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.location.href = "/account"} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" /> Thông tin tài khoản
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/account?tab=security"} className="cursor-pointer">
                    <Lock className="mr-2 h-4 w-4" /> Đổi mật khẩu
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/wallet"} className="cursor-pointer">
                    <Wallet className="mr-2 h-4 w-4" /> Nạp tiền vào ví
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/orders"} className="cursor-pointer">
                    <ShoppingBag className="mr-2 h-4 w-4" /> Lịch sử đơn hàng
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/api-docs"} className="cursor-pointer">
                    <Code2 className="mr-2 h-4 w-4" /> Tài liệu tích hợp API
                  </DropdownMenuItem>
                  {(user.role === "ADMIN" || user.role === "SUPERADMIN") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => window.location.href = "/admin"} className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-semibold">
                        <ShieldCheck className="mr-2 h-4 w-4" /> Quản trị Admin
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
