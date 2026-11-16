"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Grid, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  _count: {
    products: number;
  };
}

interface CategoryFilterBarProps {
  categories: CategoryItem[];
  activeCategoryId?: string;
  search?: string;
  sortBy?: string;
}

export function CategoryFilterBar({
  categories,
  activeCategoryId,
  search,
  sortBy = "newest",
}: CategoryFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  // Helper to build links preserving search and sortBy
  const buildUrl = (categoryId?: string, newSort?: string) => {
    const params = new URLSearchParams();
    if (categoryId) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    const effectiveSort = newSort !== undefined ? newSort : sortBy;
    if (effectiveSort && effectiveSort !== "newest") {
      params.set("sortBy", effectiveSort);
    }
    const query = params.toString();
    return `/products${query ? `?${query}` : ""}`;
  };

  // Scroll active category into view on initial load or category change
  useEffect(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const item = activeItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
        item.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeCategoryId]);

  // Filter out any categories with 0 products
  const visibleCategories = categories.filter((c) => (c._count?.products ?? 0) > 0);
  const activeCategory = visibleCategories.find((c) => c.id === activeCategoryId);
  const totalProductsCount = visibleCategories.reduce((sum, c) => sum + (c._count?.products ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* Main bar: Categories + More Button + Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Horizontal scrollable category list with 'Xem nhiều hơn' button */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 flex-1 min-w-0"
          >
            {/* 'Tất cả' Pill */}
            <Link
              ref={!activeCategoryId ? activeItemRef : undefined}
              href={buildUrl(undefined)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shadow-xs ${
                !activeCategoryId
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-card hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả
            </Link>

            {/* Category Pills */}
            {visibleCategories.map((c) => {
              const isActive = activeCategoryId === c.id;
              return (
                <Link
                  key={c.id}
                  ref={isActive ? activeItemRef : undefined}
                  href={buildUrl(c.id)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shadow-xs ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border bg-card hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{c.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c._count.products}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* 'Xem nhiều hơn' / 'Thu gọn' Toggle Button */}
          {visibleCategories.length > 0 && (
            <Button
              type="button"
              variant={isExpanded ? "default" : "outline"}
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className={`shrink-0 h-8 text-xs font-semibold gap-1.5 transition-all shadow-xs ${
                isExpanded
                  ? "bg-primary text-primary-foreground"
                  : "border-dashed hover:border-primary text-foreground"
              }`}
              title={isExpanded ? "Thu gọn danh mục" : "Xem toàn bộ thể loại sản phẩm"}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>{isExpanded ? "Thu gọn" : "Xem nhiều hơn"}</span>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-1.5 text-xs shrink-0 self-end sm:self-auto">
          <span className="text-muted-foreground font-medium text-[11px] mr-1">Sắp xếp:</span>
          <Link
            href={buildUrl(activeCategoryId, "newest")}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              sortBy === "newest"
                ? "bg-muted font-bold text-foreground border-foreground/20"
                : "text-muted-foreground hover:bg-muted/50 border-transparent"
            }`}
          >
            Mới nhất
          </Link>
          <Link
            href={buildUrl(activeCategoryId, "price_asc")}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              sortBy === "price_asc"
                ? "bg-muted font-bold text-foreground border-foreground/20"
                : "text-muted-foreground hover:bg-muted/50 border-transparent"
            }`}
          >
            Giá thấp
          </Link>
          <Link
            href={buildUrl(activeCategoryId, "price_desc")}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              sortBy === "price_desc"
                ? "bg-muted font-bold text-foreground border-foreground/20"
                : "text-muted-foreground hover:bg-muted/50 border-transparent"
            }`}
          >
            Giá cao
          </Link>
        </div>
      </div>

      {/* Expanded Dropdown Panel: Sổ các thể loại xuống */}
      {isExpanded && (
        <div className="rounded-2xl border bg-card/95 backdrop-blur-md p-4 sm:p-5 shadow-lg space-y-3.5 animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Tất cả thể loại sản phẩm
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {visibleCategories.length} danh mục
              </Badge>
              {activeCategory && (
                <span className="text-[11px] text-muted-foreground">
                  (Đang chọn: <strong className="text-primary font-bold">{activeCategory.name}</strong>)
                </span>
              )}
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
            >
              <span>Đóng</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Grid / Multi-row Category Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
            {/* 'Tất cả sản phẩm' Option */}
            <Link
              href={buildUrl(undefined)}
              onClick={() => setIsExpanded(false)}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                !activeCategoryId
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                  : "bg-background hover:border-primary/50 hover:bg-muted/50 text-foreground"
              }`}
            >
              <span className="truncate">Tất cả sản phẩm</span>
              {!activeCategoryId ? (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {totalProductsCount}
                </span>
              )}
            </Link>

            {/* Individual Categories */}
            {visibleCategories.map((c) => {
              const isActive = activeCategoryId === c.id;
              return (
                <Link
                  key={c.id}
                  href={buildUrl(c.id)}
                  onClick={() => setIsExpanded(false)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                      : "bg-background hover:border-primary/50 hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {isActive ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded-md">
                      {c._count.products}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
