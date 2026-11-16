"use client";

import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  Loader2,
  DollarSign,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Edit3,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Star,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";
import { DEFAULT_PRODUCT_IMAGE, getProductImageUrl } from "@/lib/utils/product-image";

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  category: { id: string; name: string; slug: string } | null;
  categoryId: string | null;
  supplierCost: string;
  sellingPrice: string;
  profitType: "PERCENTAGE" | "FIXED";
  profitValue: string;
  pricingMode: "AUTO" | "MANUAL";
  profitAmount: string;
  profitRatePercent: string;
  stock: number | null;
  status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED";
  isFeatured: boolean;
  isHidden: boolean;
  sortOrder: number;
  lastSyncedAt: string | null;
  createdAt: string;
  activeSupplier: {
    id: string;
    name: string;
    adapterKey: string;
    supplierProductId: string;
    supplierCost: string;
  } | null;
  mappingsCount: number;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    activeCount: 0,
    outOfStockCount: 0,
    autoPricingCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPricingMode, setSelectedPricingMode] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Ref to always track latest active filters so realtime updates and async callbacks never lose filter context
  const filtersRef = useRef({
    page: 1,
    searchTerm: "",
    selectedCategory: "",
    selectedSupplier: "ALL",
    selectedStatus: "ALL",
    selectedPricingMode: "ALL",
  });

  useEffect(() => {
    filtersRef.current = {
      page,
      searchTerm,
      selectedCategory,
      selectedSupplier,
      selectedStatus,
      selectedPricingMode,
    };
  }, [page, searchTerm, selectedCategory, selectedSupplier, selectedStatus, selectedPricingMode]);

  // Modal: Edit Price & Profit
  const [pricingModalProduct, setPricingModalProduct] = useState<ProductItem | null>(null);
  const [editPricingMode, setEditPricingMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [editProfitType, setEditProfitType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [editProfitValue, setEditProfitValue] = useState("10");
  const [editManualSellingPrice, setEditManualSellingPrice] = useState("");

  // Modal: Add / Edit Full Product
  const [editModalProduct, setEditModalProduct] = useState<Partial<ProductItem> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPricingModalOpen, setBulkPricingModalOpen] = useState(false);
  const [bulkProfitType, setBulkProfitType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [bulkProfitValue, setBulkProfitValue] = useState("15");
  const [bulkPricingMode, setBulkPricingMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [bulkManualPrice, setBulkManualPrice] = useState("");

  const isAllSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id));
  const isSomeSelected = products.some((p) => selectedIds.includes(p.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !products.some((p) => p.id === id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...products.map((p) => p.id)])]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const fetchProducts = useCallback(
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
          limit: "25",
          search: activeFilters.searchTerm,
          categoryId: activeFilters.selectedCategory,
          supplierId: activeFilters.selectedSupplier,
          status: activeFilters.selectedStatus,
          pricingMode: activeFilters.selectedPricingMode,
        });

        const res = await fetch(`/api/admin/products?${params.toString()}`);
        const json = await res.json();
        if (res.ok) {
          setProducts(json.data.products || []);
          setMetrics(
            json.data.metrics || {
              total: 0,
              activeCount: 0,
              outOfStockCount: 0,
              autoPricingCount: 0,
            }
          );
          setTotalPages(json.data.pagination?.totalPages || 1);
          if (json.data.filterOptions) {
            setCategories(json.data.filterOptions.categories || []);
            setSuppliers(json.data.filterOptions.suppliers || []);
          }
        }
      } catch {
        // Ignored
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
    fetchProducts();
  }, [fetchProducts]);

  // Realtime SSE listener for automatic catalog updates without losing filters and without flickering table
  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "product.synced" || data.type === "product.updated") {
          // Silent fetch preserves active filters and does NOT trigger full table unmount/flicker
          fetchProducts({ silent: true });
          toast.info("Đã tự động cập nhật danh mục sản phẩm thời gian thực!", {
            id: "realtime-product-sync",
            duration: 2500,
          });
        }
      } catch {}
    };
    return () => source.close();
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts({ filters: { page: 1, searchTerm } });
  };

  const handleExecuteBulkAction = async (action: string, data?: any) => {
    if (selectedIds.length === 0) return;
    setActionLoading(`bulk-${action}`);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          data,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Thao tác hàng loạt thất bại");
      toast.success(json.message || "Thao tác thành công!");
      if (action === "DELETE") {
        setSelectedIds([]);
      }
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Sync Single Product SKU
  const handleSyncProduct = async (product: ProductItem) => {
    setActionLoading(`sync-${product.id}`);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Đồng bộ SKU thất bại");
      toast.success(json.message || "Đã đồng bộ SKU từ nhà cung cấp thành công!");
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Active Status with in-place optimistic update
  const handleToggleStatus = async (product: ProductItem) => {
    const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionLoading(`toggle-${product.id}`);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: nextStatus } : p))
    );
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Cập nhật trạng thái thất bại");
      toast.success(`Đã chuyển trạng thái sang ${nextStatus === "ACTIVE" ? "ĐANG BÁN" : "TẠM NGỪNG"}`);
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
      // Rollback
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: product.status } : p))
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Hidden with in-place optimistic update
  const handleToggleHidden = async (product: ProductItem) => {
    const nextHidden = !product.isHidden;
    setActionLoading(`hidden-${product.id}`);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isHidden: nextHidden } : p))
    );
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: nextHidden }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Cập nhật hiển thị thất bại");
      toast.success(nextHidden ? "Đã ẩn sản phẩm khỏi trang chủ" : "Đã hiện sản phẩm trên trang chủ");
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isHidden: product.isHidden } : p))
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Open Quick Pricing Dialog
  const openPricingModal = (product: ProductItem) => {
    setPricingModalProduct(product);
    setEditPricingMode(product.pricingMode);
    setEditProfitType(product.profitType);
    setEditProfitValue(product.profitValue);
    setEditManualSellingPrice(product.sellingPrice);
  };

  // Save Quick Pricing Changes
  const handleSavePricing = async () => {
    if (!pricingModalProduct) return;
    setActionLoading("save-pricing");
    try {
      const body: any = {
        pricingMode: editPricingMode,
        profitType: editProfitType,
        profitValue: Number(editProfitValue) || 10,
      };
      if (editPricingMode === "MANUAL") {
        body.sellingPrice = Number(editManualSellingPrice) || 0;
      }

      const res = await fetch(`/api/admin/products/${pricingModalProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Cập nhật giá bán thất bại");
      toast.success("Đã cập nhật giá bán & công thức biên lợi nhuận thành công!");
      setPricingModalProduct(null);
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Save Full Product (Create or Edit)
  const handleSaveFullProduct = async () => {
    if (!editModalProduct) return;
    setActionLoading("save-full");
    try {
      const isCreate = isCreatingNew;
      const url = isCreate ? "/api/admin/products" : `/api/admin/products/${editModalProduct.id}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editModalProduct),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Lưu sản phẩm thất bại");
      toast.success(isCreate ? "Tạo sản phẩm mới thành công!" : "Đã cập nhật chi tiết sản phẩm!");
      setEditModalProduct(null);
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product: ProductItem) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`)) return;
    setActionLoading(`delete-${product.id}`);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error?.message || "Xóa sản phẩm thất bại");
      toast.success(json.message || "Đã xóa sản phẩm thành công!");
      fetchProducts({ silent: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Helper calculation preview for AUTO pricing modal
  const costNum = pricingModalProduct ? Number(pricingModalProduct.supplierCost) : 0;
  let simulatedSelling = costNum;
  if (editPricingMode === "AUTO") {
    const val = Number(editProfitValue) || 0;
    if (editProfitType === "PERCENTAGE") {
      simulatedSelling = Math.round(costNum * (1 + val / 100));
    } else {
      simulatedSelling = costNum + val;
    }
  } else {
    simulatedSelling = Number(editManualSellingPrice) || 0;
  }
  const simulatedProfit = simulatedSelling - costNum;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black">Quản Lý Sản Phẩm & Giá Bán</h1>
            {isRefreshing && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 animate-pulse gap-1 py-0.5 px-2">
                <RefreshCw className="h-3 w-3 animate-spin" /> Đang cập nhật live...
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Theo dõi danh mục sản phẩm số, cấu hình biên lợi nhuận tự động và liên kết nguồn hàng từ nhà cung cấp.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/admin/sync">
            <Button variant="outline" size="sm" className="font-bold text-xs gap-1.5 shadow-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Trung tâm đồng bộ NCC
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => {
              setIsCreatingNew(true);
              setEditModalProduct({
                name: "",
                description: "",
                supplierCost: "0",
                sellingPrice: "0",
                profitType: "PERCENTAGE",
                profitValue: "10",
                pricingMode: "AUTO",
                status: "ACTIVE",
                isFeatured: false,
                isHidden: false,
              });
            }}
            className="font-bold text-xs gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Thêm sản phẩm thủ công
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Tổng sản phẩm</span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black">{metrics.total}</div>
          <p className="text-[11px] text-muted-foreground">Tất cả sản phẩm trong catalogue</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Đang mở bán</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{metrics.activeCount}</div>
          <p className="text-[11px] text-muted-foreground">Sản phẩm khách hàng có thể mua</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Hết hàng / Tồn 0</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-500">{metrics.outOfStockCount}</div>
          <p className="text-[11px] text-muted-foreground">Cần NCC bổ sung kho tài khoản</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Tự động tính giá (AUTO)</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-primary">{metrics.autoPricingCount}</div>
          <p className="text-[11px] text-muted-foreground">Tự cập nhật theo biến động giá NCC</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên sản phẩm, slug hoặc mã SKU nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                  fetchProducts({ filters: { page: 1, searchTerm: "" } });
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val);
                setPage(1);
                fetchProducts({ filters: { page: 1, selectedCategory: val } });
              }}
              className="h-9 rounded-lg border bg-background px-3 text-xs font-semibold cursor-pointer"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedSupplier}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSupplier(val);
                setPage(1);
                fetchProducts({ filters: { page: 1, selectedSupplier: val } });
              }}
              className="h-9 rounded-lg border bg-background px-3 text-xs font-semibold cursor-pointer"
            >
              <option value="ALL">Tất cả nhà cung cấp</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.adapterKey})
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStatus(val);
                setPage(1);
                fetchProducts({ filters: { page: 1, selectedStatus: val } });
              }}
              className="h-9 rounded-lg border bg-background px-3 text-xs font-semibold cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang mở bán (ACTIVE)</option>
              <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              <option value="OUT_OF_STOCK">Hết hàng (OOS)</option>
            </select>

            <select
              value={selectedPricingMode}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPricingMode(val);
                setPage(1);
                fetchProducts({ filters: { page: 1, selectedPricingMode: val } });
              }}
              className="h-9 rounded-lg border bg-background px-3 text-xs font-semibold cursor-pointer"
            >
              <option value="ALL">Cơ chế giá</option>
              <option value="AUTO">Giá tự động (AUTO)</option>
              <option value="MANUAL">Ghim thủ công (MANUAL)</option>
            </select>

            <Button type="submit" size="sm" className="h-9 px-4 text-xs font-bold cursor-pointer">
              Tìm kiếm
            </Button>
          </div>
        </form>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-primary/30 bg-primary/5 text-foreground shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-xs font-bold px-2.5 py-1">
              Đã chọn {selectedIds.length} sản phẩm
            </Badge>
            <button
              onClick={handleClearSelection}
              className="text-xs text-muted-foreground hover:text-foreground underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <X className="h-3.5 w-3.5" /> Bỏ chọn
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => handleExecuteBulkAction("UPDATE_STATUS", { status: "ACTIVE" })}
              className="h-8 text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700 bg-background"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mở bán hàng loạt
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => handleExecuteBulkAction("UPDATE_STATUS", { status: "INACTIVE" })}
              className="h-8 text-xs font-semibold gap-1 text-amber-600 hover:text-amber-700 bg-background"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Tạm dừng
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => setBulkPricingModalOpen(true)}
              className="h-8 text-xs font-semibold gap-1 text-primary hover:text-primary bg-background"
            >
              <DollarSign className="h-3.5 w-3.5" /> Đổi giá / % Lời
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => handleExecuteBulkAction("SYNC")}
              className="h-8 text-xs font-semibold gap-1 text-blue-600 hover:text-blue-700 bg-background"
            >
              {actionLoading === "bulk-SYNC" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Đồng bộ NCC
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => handleExecuteBulkAction("UPDATE_VISIBILITY", { isHidden: false })}
              className="h-8 text-xs font-semibold gap-1 bg-background"
              title="Hiện trên trang bán hàng"
            >
              <Eye className="h-3.5 w-3.5" /> Hiện
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => handleExecuteBulkAction("UPDATE_VISIBILITY", { isHidden: true })}
              className="h-8 text-xs font-semibold gap-1 bg-background"
              title="Ẩn khỏi trang bán hàng"
            >
              <EyeOff className="h-3.5 w-3.5" /> Ẩn
            </Button>

            <Button
              variant="destructive"
              size="sm"
              disabled={!!actionLoading}
              onClick={() => {
                if (
                  confirm(
                    `Bạn có chắc chắn muốn xóa ${selectedIds.length} sản phẩm đã chọn không? Hành động này không thể hoàn tác!`
                  )
                ) {
                  handleExecuteBulkAction("DELETE");
                }
              }}
              className="h-8 text-xs font-semibold gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa
            </Button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    className="rounded border-muted-foreground/30 text-primary h-4 w-4 cursor-pointer focus:ring-1 focus:ring-primary"
                    title={isAllSelected ? "Bỏ chọn tất cả trang này" : "Chọn tất cả trang này"}
                  />
                </th>
                <th className="py-3 px-4">Sản phẩm</th>
                <th className="py-3 px-3">Nguồn Nhà Cung Cấp</th>
                <th className="py-3 px-3">Giá Vốn (NCC)</th>
                <th className="py-3 px-3">Giá Bán & Lợi Nhuận</th>
                <th className="py-3 px-3 text-center">Tồn kho</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    Đang tải danh sách sản phẩm...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    Không tìm thấy sản phẩm nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isAuto = p.pricingMode === "AUTO";
                  const hasSupplier = Boolean(p.activeSupplier);
                  const isSelected = selectedIds.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(p.id)}
                          className="rounded border-muted-foreground/30 text-primary h-4 w-4 cursor-pointer focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      {/* Product Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-muted/80 border shrink-0 flex items-center justify-center overflow-hidden font-bold text-muted-foreground">
                            <img
                              src={getProductImageUrl(p.image)}
                              alt={p.name}
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                              }}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate max-w-xs">
                                {p.name}
                              </span>
                              {p.isFeatured && (
                                <Badge className="text-[9px] px-1 py-0 bg-amber-500 text-white gap-0.5">
                                  <Star className="h-2.5 w-2.5 fill-white" /> Ghim
                                </Badge>
                              )}
                              {p.isHidden && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 text-muted-foreground">
                                  Đang ẩn
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {p.category && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {p.category.name}
                                </Badge>
                              )}
                              <span className="font-mono text-[10px] text-muted-foreground/80">/{p.slug}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Supplier Column */}
                      <td className="py-3.5 px-3">
                        {p.activeSupplier ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-primary block truncate max-w-[140px]">
                              {p.activeSupplier.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">SKU:</span>
                              <code className="text-[10px] bg-muted px-1 rounded font-mono font-bold">
                                {p.activeSupplier.supplierProductId}
                              </code>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">Tự quản lý kho</span>
                        )}
                      </td>

                      {/* Cost Column */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-muted-foreground">
                          {Number(p.supplierCost).toLocaleString("vi-VN")} đ
                        </span>
                      </td>

                      {/* Price & Profit Margin Column */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-foreground">
                              {Number(p.sellingPrice).toLocaleString("vi-VN")} đ
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 font-bold ${
                                isAuto ? "border-primary/40 text-primary bg-primary/5" : "border-muted-foreground/40 text-muted-foreground"
                              }`}
                            >
                              {isAuto ? "AUTO" : "MANUAL"}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <span>+{Number(p.profitAmount).toLocaleString("vi-VN")} đ</span>
                            <span className="text-[10px] text-muted-foreground">({p.profitRatePercent}%)</span>
                          </div>
                        </div>
                      </td>

                      {/* Stock Column */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {p.stock === null ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                            Không giới hạn
                          </Badge>
                        ) : p.stock <= 0 ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Hết hàng (0)
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] font-bold font-mono">
                            {p.stock} cái
                          </Badge>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          disabled={actionLoading === `toggle-${p.id}`}
                          className="cursor-pointer"
                          title="Click để bật/tắt bán"
                        >
                          <Badge
                            variant={p.status === "ACTIVE" ? "default" : "secondary"}
                            className="text-[10px] font-bold cursor-pointer"
                          >
                            {p.status === "ACTIVE" ? "ĐANG BÁN" : "TẠM DỪNG"}
                          </Badge>
                        </button>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPricingModal(p)}
                            className="h-7 px-2 text-[11px] font-semibold gap-1"
                            title="Sửa công thức giá & biên lợi nhuận"
                          >
                            <DollarSign className="h-3 w-3 text-primary" />
                            Giá & Lời
                          </Button>

                          {hasSupplier && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncProduct(p)}
                              disabled={actionLoading === `sync-${p.id}`}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              title="Đồng bộ SKU từ nhà cung cấp"
                            >
                              {actionLoading === `sync-${p.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsCreatingNew(false);
                              setEditModalProduct({ ...p });
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Chỉnh sửa thông tin chi tiết"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleHidden(p)}
                            disabled={actionLoading === `hidden-${p.id}`}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title={p.isHidden ? "Hiện trên trang chủ" : "Ẩn khỏi trang chủ"}
                          >
                            {p.isHidden ? <EyeOff className="h-3.5 w-3.5 text-amber-500" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(p)}
                            disabled={actionLoading === `delete-${p.id}`}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Xóa sản phẩm"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
            <div>
              Trang {page} / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  fetchProducts({ filters: { page: newPage } });
                }}
                className="h-7 text-xs font-semibold cursor-pointer"
              >
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  const newPage = Math.min(totalPages, page + 1);
                  setPage(newPage);
                  fetchProducts({ filters: { page: newPage } });
                }}
                className="h-7 text-xs font-semibold cursor-pointer"
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Quick Pricing & Profit Formula */}
      {pricingModalProduct && (
        <Dialog open={true} onOpenChange={() => setPricingModalProduct(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Cài Đặt Giá & Biên Lợi Nhuận
              </DialogTitle>
              <DialogDescription className="text-xs truncate max-w-sm">
                Sản phẩm: <span className="font-bold text-foreground">{pricingModalProduct.name}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Cost Highlight */}
              <div className="rounded-xl border bg-muted/40 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Giá vốn hiện tại từ NCC</span>
                  <span className="text-base font-mono font-black text-foreground">
                    {costNum.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                {pricingModalProduct.activeSupplier && (
                  <Badge variant="outline" className="text-[10px]">
                    NCC: {pricingModalProduct.activeSupplier.name}
                  </Badge>
                )}
              </div>

              {/* Pricing Mode Radio */}
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Cơ chế định giá</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPricingMode("AUTO")}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      editPricingMode === "AUTO"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="font-bold block text-xs">Tự động (AUTO)</span>
                    <span className="text-[10px] block opacity-80 mt-0.5">Tự tính giá theo vốn NCC + Lời</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditPricingMode("MANUAL")}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      editPricingMode === "MANUAL"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="font-bold block text-xs">Ghim thủ công (MANUAL)</span>
                    <span className="text-[10px] block opacity-80 mt-0.5">Đặt một mức giá cố định duy nhất</span>
                  </button>
                </div>
              </div>

              {editPricingMode === "AUTO" ? (
                <div className="space-y-3 pt-1 border-t">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground">Loại lợi nhuận</label>
                      <select
                        value={editProfitType}
                        onChange={(e) => setEditProfitType(e.target.value as any)}
                        className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold"
                      >
                        <option value="PERCENTAGE">Phần trăm (%)</option>
                        <option value="FIXED">Cố định (VNĐ)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground">
                        Giá trị lời ({editProfitType === "PERCENTAGE" ? "%" : "VNĐ"})
                      </label>
                      <Input
                        type="number"
                        value={editProfitValue}
                        onChange={(e) => setEditProfitValue(e.target.value)}
                        className="h-9 font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1 border-t">
                  <label className="font-semibold text-muted-foreground">Giá bán niêm yết (VNĐ) *</label>
                  <Input
                    type="number"
                    value={editManualSellingPrice}
                    onChange={(e) => setEditManualSellingPrice(e.target.value)}
                    className="h-9 font-mono font-bold text-sm"
                    placeholder="Nhập giá bán..."
                  />
                </div>
              )}

              {/* Simulation Result Box */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Giá bán khách hàng sẽ thấy:</span>
                  <span className="font-mono font-black text-base text-primary">
                    {simulatedSelling.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-600 font-semibold border-t border-primary/10 pt-1.5">
                  <span>Tiền lời mỗi đơn hàng:</span>
                  <span>+{simulatedProfit.toLocaleString("vi-VN")} đ</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPricingModalProduct(null)}>
                Hủy
              </Button>
              <Button onClick={handleSavePricing} disabled={actionLoading === "save-pricing"}>
                {actionLoading === "save-pricing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu cài đặt giá
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal 2: Add or Edit Full Product */}
      {editModalProduct && (
        <Dialog open={true} onOpenChange={() => setEditModalProduct(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {isCreatingNew ? "Thêm Sản Phẩm Mới" : "Chỉnh Sửa Chi Tiết Sản Phẩm"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cập nhật thông tin hiển thị, danh mục và cấu hình bán hàng cho SKU này.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Tên sản phẩm *</label>
                <Input
                  type="text"
                  required
                  value={editModalProduct.name || ""}
                  onChange={(e) => setEditModalProduct({ ...editModalProduct, name: e.target.value })}
                  placeholder="Ví dụ: Tài khoản Netflix 1 tháng Premium 4K"
                  className="h-9 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Danh mục</label>
                  <select
                    value={editModalProduct.categoryId || ""}
                    onChange={(e) => setEditModalProduct({ ...editModalProduct, categoryId: e.target.value || null })}
                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold"
                  >
                    <option value="">Không phân loại</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Tồn kho (để trống nếu vô hạn)</label>
                  <Input
                    type="number"
                    value={editModalProduct.stock !== undefined && editModalProduct.stock !== null ? editModalProduct.stock : ""}
                    onChange={(e) =>
                      setEditModalProduct({
                        ...editModalProduct,
                        stock: e.target.value !== "" ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Vô hạn / Theo NCC"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">URL Hình ảnh</label>
                <Input
                  type="text"
                  value={editModalProduct.image || ""}
                  onChange={(e) => setEditModalProduct({ ...editModalProduct, image: e.target.value })}
                  placeholder="https://..."
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Mô tả sản phẩm</label>
                <textarea
                  rows={3}
                  value={editModalProduct.description || ""}
                  onChange={(e) => setEditModalProduct({ ...editModalProduct, description: e.target.value })}
                  placeholder="Thông tin chi tiết gói tài khoản, hướng dẫn kích hoạt..."
                  className="w-full rounded-lg border bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Giá vốn (VNĐ)</label>
                  <Input
                    type="number"
                    value={editModalProduct.supplierCost || "0"}
                    onChange={(e) => setEditModalProduct({ ...editModalProduct, supplierCost: e.target.value })}
                    className="h-9 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Giá bán niêm yết (VNĐ)</label>
                  <Input
                    type="number"
                    value={editModalProduct.sellingPrice || "0"}
                    onChange={(e) => setEditModalProduct({ ...editModalProduct, sellingPrice: e.target.value })}
                    className="h-9 text-xs font-mono font-bold text-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={editModalProduct.isFeatured || false}
                    onChange={(e) => setEditModalProduct({ ...editModalProduct, isFeatured: e.target.checked })}
                    className="rounded border-muted-foreground/30 text-primary h-4 w-4"
                  />
                  Ghim nổi bật trên trang chủ
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={editModalProduct.isHidden || false}
                    onChange={(e) => setEditModalProduct({ ...editModalProduct, isHidden: e.target.checked })}
                    className="rounded border-muted-foreground/30 text-primary h-4 w-4"
                  />
                  Ẩn sản phẩm khỏi danh mục
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModalProduct(null)}>
                Hủy
              </Button>
              <Button onClick={handleSaveFullProduct} disabled={actionLoading === "save-full"}>
                {actionLoading === "save-full" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreatingNew ? "Tạo sản phẩm" : "Lưu thay đổi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Bulk Pricing & Profit Margin */}
      <Dialog open={bulkPricingModalOpen} onOpenChange={setBulkPricingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Cập nhật giá hàng loạt ({selectedIds.length} sản phẩm)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thiết lập công thức tính giá bán hoặc biên lợi nhuận cho toàn bộ {selectedIds.length} sản phẩm đang được chọn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Mode selection */}
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">Cơ chế định giá</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBulkPricingMode("AUTO")}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    bulkPricingMode === "AUTO"
                      ? "border-primary bg-primary/5 font-bold text-primary"
                      : "border-border hover:bg-muted font-medium text-muted-foreground"
                  }`}
                >
                  <div className="font-bold">Tự động (AUTO)</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Giá vốn NCC + Biên lợi nhuận</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkPricingMode("MANUAL")}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    bulkPricingMode === "MANUAL"
                      ? "border-primary bg-primary/5 font-bold text-primary"
                      : "border-border hover:bg-muted font-medium text-muted-foreground"
                  }`}
                >
                  <div className="font-bold">Ghim cố định (MANUAL)</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Đặt một mức giá bán cố định</div>
                </button>
              </div>
            </div>

            {bulkPricingMode === "AUTO" ? (
              <div className="space-y-3 p-3 rounded-xl bg-muted/40 border">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Cách tính biên lợi nhuận</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkProfitType("PERCENTAGE")}
                      className={`p-2 rounded-lg border text-center font-semibold cursor-pointer ${
                        bulkProfitType === "PERCENTAGE"
                          ? "border-primary bg-primary text-primary-foreground font-bold"
                          : "border-border bg-background"
                      }`}
                    >
                      Phần trăm (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkProfitType("FIXED")}
                      className={`p-2 rounded-lg border text-center font-semibold cursor-pointer ${
                        bulkProfitType === "FIXED"
                          ? "border-primary bg-primary text-primary-foreground font-bold"
                          : "border-border bg-background"
                      }`}
                    >
                      Số tiền cố định (VNĐ)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    {bulkProfitType === "PERCENTAGE" ? "Tỷ lệ lời (%) cộng thêm vào giá vốn" : "Số tiền lời (VNĐ) cộng thêm"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step={bulkProfitType === "PERCENTAGE" ? "1" : "1000"}
                    value={bulkProfitValue}
                    onChange={(e) => setBulkProfitValue(e.target.value)}
                    placeholder={bulkProfitType === "PERCENTAGE" ? "Ví dụ: 15" : "Ví dụ: 5000"}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {bulkProfitType === "PERCENTAGE"
                      ? "Ví dụ: Vốn NCC 10.000đ + 15% lời => Giá bán 11.500đ"
                      : "Ví dụ: Vốn NCC 10.000đ + 5.000đ lời => Giá bán 15.000đ"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
                <label className="font-semibold text-muted-foreground">Giá bán niêm yết mới (VNĐ)</label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={bulkManualPrice}
                  onChange={(e) => setBulkManualPrice(e.target.value)}
                  placeholder="Ví dụ: 25000"
                  className="h-9 text-xs font-mono font-bold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tất cả {selectedIds.length} sản phẩm sẽ được gán giá bán này bất kể giá vốn NCC.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkPricingModalOpen(false)}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={actionLoading === "bulk-UPDATE_PRICING"}
              onClick={async () => {
                await handleExecuteBulkAction("UPDATE_PRICING", {
                  pricingMode: bulkPricingMode,
                  profitType: bulkProfitType,
                  profitValue: Number(bulkProfitValue) || 10,
                  sellingPrice: bulkPricingMode === "MANUAL" ? Number(bulkManualPrice) || 0 : undefined,
                });
                setBulkPricingModalOpen(false);
              }}
            >
              {actionLoading === "bulk-UPDATE_PRICING" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Áp dụng cho {selectedIds.length} sản phẩm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
