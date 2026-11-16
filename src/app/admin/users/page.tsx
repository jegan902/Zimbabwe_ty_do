"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  User,
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  ShoppingBag,
  CreditCard,
  History,
  Lock,
  Unlock,
  Eye,
  Loader2,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filtersRef = useRef({
    page: 1,
    statusFilter: "ALL",
    roleFilter: "ALL",
    search: "",
  });

  useEffect(() => {
    filtersRef.current = {
      page,
      statusFilter,
      roleFilter,
      search,
    };
  }, [page, statusFilter, roleFilter, search]);

  // Detail Modal State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Edit Form State
  const [editFullName, setEditFullName] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editRole, setEditRole] = useState("USER");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Adjust Balance State
  const [adjustOperation, setAdjustOperation] = useState<"ADD" | "SUBTRACT">("ADD");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchUsers = useCallback(
    async (options?: {
      silent?: boolean;
      filters?: Partial<typeof filtersRef.current>;
    }) => {
      const silent = options?.silent ?? false;
      const activeFilters = {
        ...filtersRef.current,
        ...(options?.filters || {}),
      };

      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams({
          page: activeFilters.page.toString(),
          limit: "15",
          search: activeFilters.search,
          status: activeFilters.statusFilter,
          role: activeFilters.roleFilter,
        });

        const res = await fetch(`/api/admin/users?${params.toString()}`);
        const json = await res.json();
        if (res.ok) {
          setUsers(json.data?.items || []);
          setSummary(json.data?.summary || {});
          setTotalPages(json.data?.pagination?.totalPages || 1);
        } else {
          toast.error(json.error?.message || "Không thể tải danh sách khách hàng");
        }
      } catch {
        toast.error("Lỗi kết nối khi tải danh sách");
      } finally {
        if (!silent) {
          setLoading(false);
        }
        setIsRefreshing(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Realtime SSE listener for user/wallet updates without losing filters and without flickering table
  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "wallet.updated") {
          fetchUsers({ silent: true });
        }
      } catch {}
    };
    return () => source.close();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers({ filters: { page: 1, search } });
  };

  const openUserDetail = async (userId: string, defaultTab = "profile") => {
    setSelectedUserId(userId);
    setActiveTab(defaultTab);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const json = await res.json();
      if (res.ok) {
        const u = json.data;
        setSelectedUserDetail(u);
        setEditFullName(u.profile.fullName || "");
        setEditStatus(u.profile.status);
        setEditRole(u.profile.role);
        setEditNewPassword("");
        setAdjustAmount("");
        setAdjustReason("");
      } else {
        toast.error(json.error?.message || "Không thể tải chi tiết");
      }
    } catch {
      toast.error("Lỗi khi tải chi tiết khách hàng");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSavingProfile(true);
    try {
      const body: any = {
        fullName: editFullName,
        status: editStatus,
        role: editRole,
      };
      if (editNewPassword.trim()) {
        body.newPassword = editNewPassword.trim();
      }

      const res = await fetch(`/api/admin/users/${selectedUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Lỗi cập nhật");

      toast.success("Cập nhật thông tin khách hàng thành công!");
      fetchUsers({ silent: true });
      openUserDetail(selectedUserId, activeTab);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const numAmount = parseFloat(adjustAmount.replace(/,/g, ""));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Vui lòng nhập số tiền hợp lệ (> 0)");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Vui lòng nhập lý do điều chỉnh tiền ví");
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/adjust-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          operation: adjustOperation,
          reason: adjustReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Lỗi điều chỉnh số dư");

      toast.success(json.data?.message || "Điều chỉnh số dư thành công!");
      setAdjustAmount("");
      setAdjustReason("");
      fetchUsers({ silent: true });
      openUserDetail(selectedUserId, "ledger");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleQuickToggleStatus = async (user: any) => {
    const nextStatus = user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    const confirmMsg =
      nextStatus === "LOCKED"
        ? `Bạn có chắc muốn KHÓA tài khoản ${user.email}? Khách hàng sẽ không thể đăng nhập hoặc mua hàng.`
        : `MỞ KHÓA tài khoản ${user.email}?`;

    if (!confirm(confirmMsg)) return;

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Lỗi thay đổi trạng thái");

      toast.success(`Đã chuyển trạng thái sang ${nextStatus}`);
      fetchUsers({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
      fetchUsers({ silent: true });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black">Quản Lý Khách Hàng</h1>
            {isRefreshing && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30 animate-pulse">
                Đang cập nhật live...
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tra cứu hồ sơ khách hàng, số dư ví, lịch sử nạp, đơn mua và điều chỉnh số dư tài khoản.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsers({ silent: true })}
          disabled={loading || isRefreshing}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing || loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Tổng khách hàng</span>
            <span className="text-2xl font-black text-foreground">{summary.totalUsers || 0}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Đang hoạt động</span>
            <span className="text-2xl font-black text-emerald-600">{summary.activeUsers || 0}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Tài khoản bị khóa</span>
            <span className="text-2xl font-black text-rose-600">{summary.lockedUsers || 0}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
            <Lock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Tổng tiền ví khách</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {Number(summary.totalWalletBalance || 0).toLocaleString("vi-VN")}đ
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo email, tên khách hàng hoặc ID..."
            className="pl-9 pr-8 h-9 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
                fetchUsers({ filters: { page: 1, search: "" } });
              }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value;
              setStatusFilter(val);
              setPage(1);
              fetchUsers({ filters: { page: 1, statusFilter: val } });
            }}
            aria-label="Lọc theo trạng thái"
            className="h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động (ACTIVE)</option>
            <option value="LOCKED">Bị khóa (LOCKED)</option>
            <option value="SUSPENDED">Tạm ngưng (SUSPENDED)</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              const val = e.target.value;
              setRoleFilter(val);
              setPage(1);
              fetchUsers({ filters: { page: 1, roleFilter: val } });
            }}
            aria-label="Lọc theo vai trò"
            className="h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Mọi quyền</option>
            <option value="USER">Khách hàng (USER)</option>
            <option value="ADMIN">Quản trị (ADMIN)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Không tìm thấy khách hàng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Số dư ví</th>
                  <th className="py-3 px-4">Tổng đã nạp</th>
                  <th className="py-3 px-4">Tổng chi tiêu</th>
                  <th className="py-3 px-4">Đơn hàng</th>
                  <th className="py-3 px-4">Ngày đăng ký</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{u.email}</div>
                      <div className="text-[11px] text-muted-foreground">{u.fullName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.role === "ADMIN" ? "default" : "outline"} className="text-[10px]">
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={u.status === "ACTIVE" ? "default" : "destructive"}
                        className={`text-[10px] ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : ""
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-black text-amber-600 dark:text-amber-400">
                      {Number(u.balance || 0).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-600">
                      {Number(u.totalDeposits || 0).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 font-medium text-muted-foreground">
                      {Number(u.totalSpent || 0).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {u.orderCount || 0}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUserDetail(u.id, "profile")}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUserDetail(u.id, "adjust")}
                          className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          title="Cộng/Trừ tiền ví"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleQuickToggleStatus(u)}
                          className={`h-7 w-7 p-0 ${
                            u.status === "ACTIVE"
                              ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          }`}
                          title={u.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                        >
                          {u.status === "ACTIVE" ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  fetchUsers({ filters: { page: p } });
                }}
                disabled={page <= 1}
                className="h-7 text-xs"
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  fetchUsers({ filters: { page: p } });
                }}
                disabled={page >= totalPages}
                className="h-7 text-xs"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail & Edit Modal with Tabs */}
      {selectedUserId && (
        <Dialog open={true} onOpenChange={() => setSelectedUserId(null)}>
          <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span>Chi tiết khách hàng</span>
                {selectedUserDetail?.profile?.email && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedUserDetail.profile.email}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Xem toàn bộ thông tin tài khoản, ví tiền, lịch sử nạp tiền, đơn mua hàng và sổ cái kiểm toán.
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !selectedUserDetail ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Không tìm thấy dữ liệu</div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Horizontal Tab Navigation */}
                <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 overflow-x-auto w-full">
                  {[
                    { id: "profile", label: "Hồ sơ & Sửa", icon: User },
                    { id: "adjust", label: "Cộng/Trừ Ví", icon: Wallet },
                    { id: "deposits", label: "Lịch sử nạp", icon: CreditCard },
                    { id: "orders", label: "Lịch sử mua", icon: ShoppingBag },
                    { id: "ledger", label: "Sổ cái ví", icon: History },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 justify-center ${
                          isActive
                            ? "bg-background text-foreground shadow-xs border border-border/40"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab 1: Profile & Edit */}
                {activeTab === "profile" && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <span className="text-[10px] text-muted-foreground block">Số dư khả dụng</span>
                        <span className="font-black text-base text-primary block mt-0.5">
                          {Number(selectedUserDetail.wallet.availableBalance || 0).toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <span className="text-[10px] text-muted-foreground block">Tiền đang giữ (Đơn)</span>
                        <span className="font-bold text-base text-amber-600 block mt-0.5">
                          {Number(selectedUserDetail.wallet.reservedBalance || 0).toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <span className="text-[10px] text-muted-foreground block">Tổng tiền đã nạp</span>
                        <span className="font-bold text-base text-emerald-600 block mt-0.5">
                          {Number(selectedUserDetail.wallet.totalDeposits || 0).toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <span className="text-[10px] text-muted-foreground block">Tổng chi tiêu</span>
                        <span className="font-bold text-base text-foreground block mt-0.5">
                          {Number(selectedUserDetail.wallet.totalSpent || 0).toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-3.5 border-t pt-3.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Họ và tên</label>
                          <Input
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                            placeholder="Nhập họ và tên khách hàng"
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Email đăng nhập</label>
                          <Input
                            value={selectedUserDetail.profile.email}
                            disabled
                            className="h-9 text-xs bg-muted/50 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Trạng thái tài khoản</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-semibold focus:ring-1 focus:ring-primary"
                          >
                            <option value="ACTIVE">ACTIVE (Hoạt động bình thường)</option>
                            <option value="LOCKED">LOCKED (Khóa đăng nhập)</option>
                            <option value="SUSPENDED">SUSPENDED (Tạm ngưng do vi phạm)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Vai trò phân quyền</label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-semibold focus:ring-1 focus:ring-primary"
                          >
                            <option value="USER">USER (Khách hàng thông thường)</option>
                            <option value="ADMIN">ADMIN (Quản trị viên hệ thống)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1 pt-1">
                        <label className="font-semibold text-muted-foreground">
                          Đặt lại mật khẩu mới (Bỏ trống nếu không muốn đổi)
                        </label>
                        <Input
                          type="password"
                          value={editNewPassword}
                          onChange={(e) => setEditNewPassword(e.target.value)}
                          placeholder="Nhập mật khẩu mới ít nhất 6 ký tự..."
                          className="h-9 text-xs font-mono"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={savingProfile} size="sm" className="text-xs font-bold px-4">
                          {savingProfile && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          Lưu thay đổi hồ sơ
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Tab 2: Adjust Balance */}
                {activeTab === "adjust" && (
                  <div className="space-y-4 pt-1 text-xs">
                    <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-3.5 text-amber-800 dark:text-amber-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-xs">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Lưu ý điều chỉnh số dư thủ công:
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Thao tác cộng hoặc trừ tiền sẽ được ghi vào sổ cái (Ledger) kiểm toán vĩnh viễn với mã giao dịch ADJUSTMENT và lưu vết Admin thực hiện.
                      </p>
                    </div>

                    <form onSubmit={handleAdjustBalance} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-muted-foreground">Loại thao tác:</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setAdjustOperation("ADD")}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                              adjustOperation === "ADD"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-muted/40 hover:bg-muted"
                            }`}
                          >
                            <PlusCircle className="h-4 w-4" />
                            + Cộng tiền vào ví
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustOperation("SUBTRACT")}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                              adjustOperation === "SUBTRACT"
                                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                : "bg-muted/40 hover:bg-muted"
                            }`}
                          >
                            <MinusCircle className="h-4 w-4" />
                            - Trừ bớt tiền ví
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Số tiền (VNĐ):</label>
                        <Input
                          type="number"
                          min="1000"
                          step="1000"
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          placeholder="Ví dụ: 50000"
                          required
                          className="h-10 text-sm font-bold font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Lý do điều chỉnh (Bắt buộc):</label>
                        <Input
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          placeholder="Ví dụ: Hoàn tiền sự cố đơn hàng #ABC, nạp tiền offline theo yêu cầu..."
                          required
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          disabled={adjusting}
                          size="sm"
                          className={`text-xs font-bold px-4 ${
                            adjustOperation === "ADD" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                          }`}
                        >
                          {adjusting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          Xác nhận {adjustOperation === "ADD" ? "Cộng tiền" : "Trừ tiền"}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Tab 3: Deposits History */}
                {activeTab === "deposits" && (
                  <div className="space-y-3 pt-1">
                    {selectedUserDetail.deposits.length === 0 ? (
                      <div className="py-10 text-center text-xs text-muted-foreground">Khách hàng chưa có giao dịch nạp tiền nào.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-96 border rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 sticky top-0 border-b">
                            <tr className="font-semibold text-muted-foreground">
                              <th className="p-3">Mã nạp</th>
                              <th className="p-3">Số tiền</th>
                              <th className="p-3">Thực nhận</th>
                              <th className="p-3">Trạng thái</th>
                              <th className="p-3">Cổng</th>
                              <th className="p-3">Thời gian</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedUserDetail.deposits.map((d: any) => (
                              <tr key={d.id} className="hover:bg-muted/20">
                                <td className="p-3 font-mono font-bold">{d.paymentCode}</td>
                                <td className="p-3 font-semibold">{Number(d.amount).toLocaleString("vi-VN")}đ</td>
                                <td className="p-3 font-bold text-emerald-600">
                                  {d.receivedAmount ? `${Number(d.receivedAmount).toLocaleString("vi-VN")}đ` : "-"}
                                </td>
                                <td className="p-3">
                                  <Badge variant={d.status === "VERIFIED" ? "default" : "outline"} className="text-[10px]">
                                    {d.status}
                                  </Badge>
                                </td>
                                <td className="p-3 text-muted-foreground">{d.gateway}</td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">
                                  {new Date(d.createdAt).toLocaleString("vi-VN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Purchase History */}
                {activeTab === "orders" && (
                  <div className="space-y-3 pt-1">
                    {selectedUserDetail.orders.length === 0 ? (
                      <div className="py-10 text-center text-xs text-muted-foreground">Khách hàng chưa mua đơn hàng nào.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-96 border rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 sticky top-0 border-b">
                            <tr className="font-semibold text-muted-foreground">
                              <th className="p-3">Mã đơn</th>
                              <th className="p-3">Sản phẩm</th>
                              <th className="p-3">SL</th>
                              <th className="p-3">Tổng tiền</th>
                              <th className="p-3">Trạng thái</th>
                              <th className="p-3">Thời gian</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedUserDetail.orders.map((o: any) => (
                              <tr key={o.id} className="hover:bg-muted/20">
                                <td className="p-3 font-mono font-bold">{o.orderCode}</td>
                                <td className="p-3 font-medium max-w-[250px] truncate">{o.productName}</td>
                                <td className="p-3 font-semibold">{o.quantity}</td>
                                <td className="p-3 font-bold">{Number(o.totalAmount).toLocaleString("vi-VN")}đ</td>
                                <td className="p-3">
                                  <Badge variant={o.status === "SUCCESS" ? "default" : "outline"} className="text-[10px]">
                                    {o.status}
                                  </Badge>
                                </td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">
                                  {new Date(o.createdAt).toLocaleString("vi-VN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Wallet Ledger */}
                {activeTab === "ledger" && (
                  <div className="space-y-3 pt-1">
                    {selectedUserDetail.ledger.length === 0 ? (
                      <div className="py-10 text-center text-xs text-muted-foreground">Chưa có giao dịch ví nào được ghi nhận.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-96 border rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 sticky top-0 border-b">
                            <tr className="font-semibold text-muted-foreground">
                              <th className="p-3">Loại</th>
                              <th className="p-3">Số tiền</th>
                              <th className="p-3">Trước GD</th>
                              <th className="p-3">Sau GD</th>
                              <th className="p-3">Mô tả</th>
                              <th className="p-3">Thời gian</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedUserDetail.ledger.map((l: any) => (
                              <tr key={l.id} className="hover:bg-muted/20">
                                <td className="p-3">
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {l.type}
                                  </Badge>
                                </td>
                                <td className="p-3 font-bold">
                                  {Number(l.amount).toLocaleString("vi-VN")}đ
                                </td>
                                <td className="p-3 text-muted-foreground">{Number(l.balanceBefore).toLocaleString("vi-VN")}đ</td>
                                <td className="p-3 font-bold text-primary">{Number(l.balanceAfter).toLocaleString("vi-VN")}đ</td>
                                <td className="p-3 text-muted-foreground max-w-[250px] truncate" title={l.description}>
                                  {l.description || "-"}
                                </td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">
                                  {new Date(l.createdAt).toLocaleString("vi-VN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedUserId(null)} className="text-xs">
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
