"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Code2,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Info,
  Server,
  Terminal,
  ShieldAlert,
  Play,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";

interface ApiData {
  apiKey: string;
  ipWhitelist: string;
  username?: string;
  balance?: number;
}

export default function ApiDocsPage() {
  const { user, loading: authLoading } = useAuth();
  const [apiData, setApiData] = useState<ApiData>({
    apiKey: "",
    ipWhitelist: "",
  });
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [savingIp, setSavingIp] = useState(false);
  const [ipWhitelistInput, setIpWhitelistInput] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeCodeLang, setActiveCodeLang] = useState<
    "curl" | "php" | "nodejs" | "python"
  >("curl");

  // Live test state
  const [testEndpoint, setTestEndpoint] = useState<
    "profile" | "products" | "product"
  >("profile");
  const [testProductId, setTestProductId] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Expanded endpoint details
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(
    "buy",
  );

  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const fetchApiKeyData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/user/api-key");
      const data = await res.json();
      if (res.ok && data.data) {
        setApiData(data.data);
        setIpWhitelistInput(data.data.ipWhitelist || "");
      }
    } catch {
      toast.error("Không thể tải thông tin API Key");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchApiKeyData();
    }
  }, [user, authLoading]);

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(identifier);
    toast.success("Đã sao chép vào bộ nhớ tạm!");
    setTimeout(() => {
      setCopiedField((curr) => (curr === identifier ? null : curr));
    }, 2000);
  };

  const handleRegenerateKey = async () => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn đổi API Key mới? API Key cũ sẽ bị vô hiệu hóa ngay lập tức!",
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/user/api-key/regenerate", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.data?.apiKey) {
        setApiData((prev) => ({ ...prev, apiKey: data.data.apiKey }));
        toast.success("Đã làm mới API Key thành công!");
      } else {
        toast.error(data.error?.message || "Tạo lại API Key thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối khi tạo lại API Key");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveIpWhitelist = async () => {
    setSavingIp(true);
    try {
      const res = await fetch("/api/user/api-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipWhitelist: ipWhitelistInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiData((prev) => ({ ...prev, ipWhitelist: ipWhitelistInput }));
        toast.success("Đã cập nhật danh sách IP Whitelist!");
      } else {
        toast.error(data.error?.message || "Lỗi cập nhật IP Whitelist");
      }
    } catch {
      toast.error("Lỗi khi kết nối đến server");
    } finally {
      setSavingIp(false);
    }
  };

  // Không hardcode key mẫu: khách chưa đăng nhập / chưa có key sẽ thấy placeholder.
  const currentApiKey = apiData.apiKey || "YOUR_API_KEY";

  const getMaskedKey = (key: string) => {
    if (!key) return "Chưa tạo API Key";
    if (key.length <= 8) return "••••••••••••••••••••";
    return `${key.slice(0, 4)}**************************************************${key.slice(-4)}`;
  };

  const runLiveTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      let url = "";
      if (testEndpoint === "profile") {
        url = `/api/profile.php?api_key=${encodeURIComponent(currentApiKey)}`;
      } else if (testEndpoint === "products") {
        url = `/api/products.php?api_key=${encodeURIComponent(currentApiKey)}`;
      } else if (testEndpoint === "product") {
        const id = testProductId.trim() || "cmw4oh6s7000cq6rqu6wkc5un";
        url = `/api/product.php?api_key=${encodeURIComponent(currentApiKey)}&id=${encodeURIComponent(id)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
      if (res.ok && data.status === "success") {
        toast.success("Gọi API thành công!");
      } else {
        toast.error(data.msg || "API trả về lỗi hoặc thiếu quyền");
      }
    } catch (err: any) {
      setTestResult(
        JSON.stringify(
          { status: "error", msg: err?.message || "Không thể kết nối API" },
          null,
          2,
        ),
      );
      toast.error("Lỗi khi gửi yêu cầu");
    } finally {
      setTestLoading(false);
    }
  };

  const endpoints = [
    {
      id: "profile",
      title: "Lấy thông tin tài khoản",
      desc: "Kiểm tra số dư khả dụng trong ví, trạng thái tài khoản và thông tin đối tác.",
      method: "GET",
      url: `${baseUrl}/api/profile.php?api_key=${currentApiKey}`,
      shortUrl: "/api/profile.php?api_key=...",
      params: [
        {
          name: "api_key",
          type: "string",
          required: true,
          desc: "Khóa API Key của tài khoản",
        },
      ],
      sampleResponse: {
        status: "success",
        msg: "Lấy thông tin tài khoản thành công",
        data: {
          username: apiData.username || "doitac_vip",
          email: user?.email || "partner@example.com",
          balance: apiData.balance ?? 1500000,
          currency: "VND",
          ip_whitelist: apiData.ipWhitelist || "",
        },
      },
    },
    {
      id: "products",
      title: "Lấy danh sách chuyên mục và sản phẩm",
      desc: "Đồng bộ toàn bộ danh mục và các sản phẩm đang mở bán về hệ thống của bạn để niêm yết bán lại.",
      method: "GET",
      url: `${baseUrl}/api/products.php?api_key=${currentApiKey}`,
      shortUrl: "/api/products.php?api_key=...",
      params: [
        {
          name: "api_key",
          type: "string",
          required: true,
          desc: "Khóa API Key của bạn",
        },
      ],
      sampleResponse: {
        status: "success",
        msg: "Lấy danh sách sản phẩm thành công",
        total_categories: 5,
        total_products: 48,
        categories: [
          {
            id: "cat_982",
            name: "Tài khoản Canva Pro",
            slug: "tai-khoan-canva-pro",
            products: [
              {
                id: "prod_101",
                name: "Canva Pro vĩnh viễn nâng cấp chính chủ",
                price: 75000,
                cost: 75000,
                stock: 999,
                status: "ACTIVE",
              },
            ],
          },
        ],
      },
    },
    {
      id: "product",
      title: "Lấy chi tiết sản phẩm",
      desc: "Lấy thông tin chi tiết, giá bán, tồn kho tức thì của một sản phẩm theo ID hoặc Slug.",
      method: "GET",
      url: `${baseUrl}/api/product.php?api_key=${currentApiKey}&id={PRODUCT_ID}`,
      shortUrl: "/api/product.php?api_key=...&id=ID",
      params: [
        {
          name: "api_key",
          type: "string",
          required: true,
          desc: "Khóa API Key",
        },
        {
          name: "id",
          type: "string",
          required: true,
          desc: "ID hoặc Slug của sản phẩm cần xem",
        },
      ],
      sampleResponse: {
        status: "success",
        msg: "Lấy chi tiết sản phẩm thành công",
        data: {
          id: "prod_101",
          product_id: "prod_101",
          name: "Canva Pro vĩnh viễn nâng cấp chính chủ",
          price: 75000,
          cost: 75000,
          stock: 999,
          category_name: "Tài khoản Canva Pro",
          product_status: "ACTIVE",
        },
      },
    },
    {
      id: "order",
      title: "Lấy chi tiết đơn hàng",
      desc: "Tra cứu trạng thái xử lý và nhận lại thông tin tài khoản / license bàn giao theo mã đơn hàng.",
      method: "GET",
      url: `${baseUrl}/api/order.php?api_key=${currentApiKey}&id={ORDER_ID}`,
      shortUrl: "/api/order.php?api_key=...&id=ORDER_ID",
      params: [
        {
          name: "api_key",
          type: "string",
          required: true,
          desc: "Khóa API Key",
        },
        {
          name: "id",
          type: "string",
          required: true,
          desc: "Mã đơn hàng (VD: DH123456) hoặc ID đơn",
        },
      ],
      sampleResponse: {
        status: "success",
        msg: "Lấy chi tiết đơn hàng thành công",
        data: {
          order_code: "DH872619XYZ",
          product_name: "Canva Pro vĩnh viễn nâng cấp chính chủ",
          quantity: 1,
          total_amount: 75000,
          status: "SUCCESS",
          data: ["canva_user@gmail.com|Password123#|2fa_secret"],
        },
      },
    },
    {
      id: "buy",
      title: "Mua hàng",
      desc: "Gửi lệnh mua sản phẩm tự động khi có khách hàng đặt mua trên trang web hoặc tool của bạn.",
      method: "POST or GET",
      url: `${baseUrl}/api/buy_product`,
      shortUrl: "/api/buy_product",
      isForm: true,
      formData: [
        {
          field: "action",
          value: "buyProduct",
          desc: "Hành động (bắt buộc phải là buyProduct)",
        },
        {
          field: "id",
          value: "ID sản phẩm cần mua",
          desc: "ID sản phẩm (lấy từ API danh sách sản phẩm)",
        },
        {
          field: "amount",
          value: "Số lượng cần mua",
          desc: "Số lượng mua (mặc định 1)",
        },
        {
          field: "coupon",
          value: "Mã giảm giá nếu có",
          desc: "Mã coupon ưu đãi (nếu có)",
        },
        {
          field: "api_key",
          value: currentApiKey,
          desc: "Khóa API Key của bạn",
        },
      ],
      sampleResponse: {
        status: "success",
        msg: "Mua hàng thành công!",
        trans_id: "DH872619XYZ",
        order_code: "DH872619XYZ",
        product_id: "prod_101",
        amount: 1,
        total_price: 75000,
        data: ["canva_user@gmail.com|Password123#|2fa_secret"],
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background pb-20">
      {/* Top Banner Header matching the screenshot */}
      <div className="container mx-auto px-4 pt-8 max-w-6xl">
        <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 p-5 shadow-2xl text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800/90 text-primary border border-neutral-700/80 shadow-inner">
              <FileCode2 className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wide text-white flex items-center gap-2">
                TÀI LIỆU TÍCH HỢP API
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cung cấp chuẩn API kết nối tự động giúp các đối tác và đại lý
                đồng bộ sản phẩm và mua hàng trực tiếp
              </p>
            </div>
          </div>
        </div>

        {/* Guest Warning if not logged in */}
        {!user && !authLoading && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
              <span>
                Bạn đang xem tài liệu API mẫu. Hãy <strong>Đăng nhập</strong>{" "}
                hoặc <strong>Đăng ký</strong> để nhận API Key cá nhân và số dư
                ví riêng của bạn.
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/login">
                <Button size="sm" variant="default" className="font-semibold">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  variant="outline"
                  className="font-semibold bg-background"
                >
                  Đăng ký
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Main API Key & IP Whitelist Card matching Screenshot 1 */}
        <div className="mt-6 rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
          <div className="space-y-6">
            {/* API Key Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <label className="md:col-span-3 text-sm font-bold text-foreground">
                API Key:
              </label>
              <div className="md:col-span-9 flex flex-wrap sm:flex-nowrap items-center gap-2">
                <div className="flex-1 min-w-[280px] bg-slate-100 dark:bg-muted/70 px-4 py-2.5 rounded-lg border font-mono text-sm tracking-wide overflow-x-auto text-blue-600 dark:text-blue-400 font-semibold select-all">
                  {showKey ? currentApiKey : getMaskedKey(currentApiKey)}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 bg-sky-500 text-white hover:bg-sky-600 hover:text-white border-none shadow-sm"
                  title={showKey ? "Ẩn API Key" : "Hiện API Key"}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 border border-input hover:bg-accent"
                  title="Sao chép API Key"
                  onClick={() => handleCopy(currentApiKey, "apikey-main")}
                >
                  {copiedField === "apikey-main" ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>

                {user && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-10 w-10 shrink-0 bg-rose-500 hover:bg-rose-600 shadow-sm"
                    title="Đổi API Key mới"
                    disabled={regenerating}
                    onClick={handleRegenerateKey}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`}
                    />
                  </Button>
                )}
              </div>
            </div>

            {/* IP Whitelist Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
              <label className="md:col-span-3 text-sm font-bold text-foreground pt-2">
                Danh sách IP Whitelist:
              </label>
              <div className="md:col-span-9 space-y-3">
                <Textarea
                  placeholder="Nhập danh sách IP được phép truy cập API (mỗi dòng 1 IP)"
                  value={ipWhitelistInput}
                  onChange={(e) => setIpWhitelistInput(e.target.value)}
                  className="min-h-[120px] font-mono text-sm bg-background border-input shadow-inner focus-visible:ring-primary"
                  disabled={!user || loading}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 shadow-sm flex items-center gap-2"
                    disabled={!user || savingIp}
                    onClick={handleSaveIpWhitelist}
                  >
                    <Save className="h-4 w-4" />
                    <span>{savingIp ? "Đang lưu..." : "Lưu danh sách IP"}</span>
                  </Button>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Để trống để cho phép tất cả IP truy cập API</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Step Quick Integration Guide */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">
              Quy trình tích hợp kéo hàng tự động
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm relative overflow-hidden">
              <div className="text-3xl font-black text-primary/20 absolute top-2 right-3">
                01
              </div>
              <div className="font-bold text-sm mb-1 text-primary">
                Nạp tiền vào ví
              </div>
              <p className="text-xs text-muted-foreground">
                Đăng ký tài khoản và nạp số dư sẵn vào ví để hệ thống tự động
                trừ tiền khi mua qua API.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm relative overflow-hidden">
              <div className="text-3xl font-black text-primary/20 absolute top-2 right-3">
                02
              </div>
              <div className="font-bold text-sm mb-1 text-primary">
                Lấy API Key
              </div>
              <p className="text-xs text-muted-foreground">
                Copy API Key phía trên và cài đặt IP Whitelist của máy chủ của
                bạn để bảo mật tuyệt đối.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm relative overflow-hidden">
              <div className="text-3xl font-black text-primary/20 absolute top-2 right-3">
                03
              </div>
              <div className="font-bold text-sm mb-1 text-primary">
                Kéo danh sách sản phẩm
              </div>
              <p className="text-xs text-muted-foreground">
                Gọi endpoint{" "}
                <code className="text-xs font-mono bg-muted px-1 rounded">
                  /api/products.php
                </code>{" "}
                để lấy danh mục & giá niêm yết lên web của bạn.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm relative overflow-hidden">
              <div className="text-3xl font-black text-primary/20 absolute top-2 right-3">
                04
              </div>
              <div className="font-bold text-sm mb-1 text-primary">
                Tự động Mua hàng
              </div>
              <p className="text-xs text-muted-foreground">
                Khi khách order trên web của bạn, hệ thống bạn gọi{" "}
                <code className="text-xs font-mono bg-muted px-1 rounded">
                  /api/buy_product
                </code>{" "}
                và nhận tài khoản trả lại ngay lập tức.
              </p>
            </div>
          </div>
        </div>

        {/* Endpoints List Section matching Screenshot 1 & 2 */}
        <div className="mt-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Danh sách các API Endpoints</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Hỗ trợ đầy đủ định dạng GET, POST & Form-data
            </span>
          </div>

          <div className="rounded-2xl border bg-card divide-y shadow-sm">
            {endpoints.map((ep) => {
              const isExpanded = expandedEndpoint === ep.id;
              return (
                <div
                  key={ep.id}
                  className="p-5 md:p-6 transition-colors hover:bg-muted/10"
                >
                  {/* Top line: Label + Method badge + URL + Copy Button */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    <div className="lg:col-span-3">
                      <div className="font-bold text-sm text-foreground flex items-center gap-2">
                        {ep.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {ep.desc}
                      </div>
                    </div>

                    <div className="lg:col-span-9 flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <span
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider ${
                          ep.method.includes("POST")
                            ? "bg-purple-600/15 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            : "bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700"
                        }`}
                      >
                        {ep.method}
                      </span>

                      <div className="flex-1 min-w-[240px] bg-slate-100 dark:bg-muted/70 px-3.5 py-1.5 rounded-lg border font-mono text-xs text-muted-foreground overflow-x-auto truncate">
                        {ep.url}
                      </div>

                      <Button
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 h-8 shrink-0 flex items-center gap-1.5 shadow-sm"
                        onClick={() => handleCopy(ep.url, `ep-${ep.id}`)}
                      >
                        {copiedField === `ep-${ep.id}` ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        title="Xem chi tiết"
                        onClick={() =>
                          setExpandedEndpoint(isExpanded ? null : ep.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Section: Parameters & Response */}
                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t border-border/60 space-y-4">
                      {ep.isForm && ep.formData ? (
                        <div className="space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Định dạng gửi lên (multipart/form-data hoặc JSON):
                          </div>
                          <div className="rounded-xl border bg-muted/40 p-3 font-mono text-xs space-y-1">
                            {ep.formData.map((f) => (
                              <div
                                key={f.field}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <span className="font-bold text-foreground">
                                  {f.field}:
                                </span>
                                <span
                                  className={
                                    f.field === "api_key"
                                      ? "text-blue-600 dark:text-blue-400 font-semibold"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {f.value}
                                </span>
                                <span className="text-[11px] text-muted-foreground/80 italic ml-2">
                                  ({f.desc})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Tham số (Query parameters):
                          </div>
                          <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-muted text-muted-foreground">
                                <tr>
                                  <th className="p-2.5">Tham số</th>
                                  <th className="p-2.5">Kiểu</th>
                                  <th className="p-2.5">Bắt buộc</th>
                                  <th className="p-2.5">Mô tả</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {ep.params?.map((p) => (
                                  <tr key={p.name}>
                                    <td className="p-2.5 font-mono font-bold text-primary">
                                      {p.name}
                                    </td>
                                    <td className="p-2.5 text-muted-foreground">
                                      {p.type}
                                    </td>
                                    <td className="p-2.5">
                                      {p.required ? (
                                        <span className="text-rose-500 font-semibold">
                                          Có
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">
                                          Không
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-foreground">
                                      {p.desc}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Response format */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Response mẫu (JSON):
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                JSON.stringify(ep.sampleResponse, null, 2),
                                `res-${ep.id}`,
                              )
                            }
                            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Copy className="h-3 w-3" /> Sao chép JSON
                          </button>
                        </div>
                        <div className="relative rounded-xl border bg-slate-950 p-4 font-mono text-xs text-slate-100 overflow-x-auto">
                          <pre>
                            {JSON.stringify(ep.sampleResponse, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Code Snippets Section */}
        <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">
                Code Mẫu Tích Hợp (SDK / Code Snippet)
              </h2>
            </div>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {(["curl", "php", "nodejs", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveCodeLang(lang)}
                  className={`px-3 py-1 text-xs font-bold rounded-md uppercase transition-colors ${
                    activeCodeLang === lang
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang === "nodejs" ? "Node.js" : lang}
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded-xl border bg-slate-950 p-4 font-mono text-xs text-slate-100 overflow-x-auto">
            <button
              type="button"
              className="absolute top-3 right-3 rounded-lg bg-neutral-800 px-2.5 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700 flex items-center gap-1 font-sans"
              onClick={() => {
                const code = getCodeSnippet(
                  activeCodeLang,
                  baseUrl,
                  currentApiKey,
                );
                handleCopy(code, "code-snippet");
              }}
            >
              {copiedField === "code-snippet" ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span>Copy code</span>
            </button>
            <pre className="pt-2">
              {getCodeSnippet(activeCodeLang, baseUrl, currentApiKey)}
            </pre>
          </div>
        </div>

        {/* Live Test Console */}
        <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Play className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold">
              Công cụ Kiểm tra API trực tiếp (Live API Tester)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Chọn API cần thử:
              </label>
              <select
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value as any)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="profile">
                  GET /api/profile.php (Thông tin ví & tài khoản)
                </option>
                <option value="products">
                  GET /api/products.php (Danh sách sản phẩm)
                </option>
                <option value="product">
                  GET /api/product.php (Chi tiết sản phẩm)
                </option>
              </select>
            </div>

            {testEndpoint === "product" && (
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  ID sản phẩm:
                </label>
                <input
                  type="text"
                  placeholder="Nhập ID sản phẩm..."
                  value={testProductId}
                  onChange={(e) => setTestProductId(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div
              className={`${testEndpoint === "product" ? "md:col-span-4" : "md:col-span-8"} flex gap-2`}
            >
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 flex items-center justify-center gap-2 shadow-sm"
                onClick={runLiveTest}
                disabled={testLoading}
              >
                <Play
                  className={`h-4 w-4 ${testLoading ? "animate-spin" : ""}`}
                />
                <span>
                  {testLoading ? "Đang gửi yêu cầu..." : "Gửi Test Thử Ngay"}
                </span>
              </Button>
            </div>
          </div>

          {testResult && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-muted-foreground uppercase">
                Kết quả trả về:
              </div>
              <div className="rounded-xl border bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[300px]">
                <pre>{testResult}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Support Footer Callout */}
        <div className="mt-10 rounded-2xl border bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-indigo-500/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base">
              Cần hỗ trợ tích hợp hoặc kết nối kỹ thuật?
            </h3>
            <p className="text-xs text-muted-foreground">
              Đội ngũ kỹ thuật hỗ trợ cài đặt mã nguồn kết nối, webhook và chiết
              khấu đại lý 24/7.
            </p>
          </div>
          <Link href="/wallet">
            <Button className="font-bold shrink-0">
              Nạp tiền vào ví ngay
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function getCodeSnippet(
  lang: "curl" | "php" | "nodejs" | "python",
  baseUrl: string,
  apiKey: string,
) {
  if (lang === "curl") {
    return `# 1. Lấy thông tin tài khoản & số dư:
curl -X GET "${baseUrl}/api/profile.php?api_key=${apiKey}"

# 2. Lấy danh sách sản phẩm:
curl -X GET "${baseUrl}/api/products.php?api_key=${apiKey}"

# 3. Đặt mua hàng tự động (form-data):
curl -X POST "${baseUrl}/api/buy_product" \\
  -F "action=buyProduct" \\
  -F "id=PRODUCT_ID" \\
  -F "amount=1" \\
  -F "api_key=${apiKey}"`;
  }

  if (lang === "php") {
    return `<?php
// Ví dụ hàm mua hàng tự động bằng PHP cURL
function buyProduct($productId, $amount = 1) {
    $apiKey = "${apiKey}";
    $url = "${baseUrl}/api/buy_product";

    $postData = [
        'action'  => 'buyProduct',
        'id'      => $productId,
        'amount'  => $amount,
        'api_key' => $apiKey,
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

// Gọi test
$result = buyProduct("PROD_12345", 1);
if ($result['status'] === 'success') {
    echo "Mua thành công! Trans ID: " . $result['trans_id'];
    print_r($result['data']); // Mảng chứa tài khoản / license
} else {
    echo "Lỗi: " . $result['msg'];
}
?>`;
  }

  if (lang === "nodejs") {
    return `// Cài đặt: npm install axios
import axios from 'axios';
import FormData from 'form-data';

const BASE_URL = '${baseUrl}';
const API_KEY = '${apiKey}';

// 1. Kéo danh sách sản phẩm
async function getProducts() {
  const res = await axios.get(\`\${BASE_URL}/api/products.php?api_key=\${API_KEY}\`);
  return res.data;
}

// 2. Mua hàng tự động
async function buyProduct(productId, amount = 1) {
  const form = new FormData();
  form.append('action', 'buyProduct');
  form.append('id', productId);
  form.append('amount', amount);
  form.append('api_key', API_KEY);

  const res = await axios.post(\`\${BASE_URL}/api/buy_product\`, form, {
    headers: form.getHeaders(),
  });
  return res.data;
}

// Test
buyProduct('cmw4oh6s7000cq6rqu6wkc5un', 1).then(data => {
  console.log('Kết quả mua:', data);
});`;
  }

  if (lang === "python") {
    return `# Cài đặt: pip install requests
import requests

BASE_URL = "${baseUrl}"
API_KEY = "${apiKey}"

# 1. Lấy thông tin tài khoản
def get_profile():
    res = requests.get(f"{BASE_URL}/api/profile.php", params={"api_key": API_KEY})
    return res.json()

# 2. Đặt mua sản phẩm
def buy_product(product_id, amount=1):
    payload = {
        "action": "buyProduct",
        "id": product_id,
        "amount": amount,
        "api_key": API_KEY
    }
    res = requests.post(f"{BASE_URL}/api/buy_product", data=payload)
    return res.json()

if __name__ == "__main__":
    result = buy_product("cmw4oh6s7000cq6rqu6wkc5un", amount=1)
    print("Kết quả:", result)`;
  }

  return "";
}
