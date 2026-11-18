import Link from "next/link";
import { Shield, Zap, RefreshCw, Headphones } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40 mt-auto">
      <div className="container mx-auto px-4 py-12 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="flex items-start gap-3">
            <Zap className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Giao hàng tự động</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Hệ thống xử lý và bàn giao tài khoản ngay tức thì 24/7
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCw className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Đồng bộ đa nguồn</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Kết nối trực tiếp API nhiều nhà cung cấp giá gốc tốt nhất
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Bảo mật giao dịch</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Mã hóa thông tin bàn giao an toàn tuyệt đối
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Headphones className="h-6 w-6 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Hỗ trợ nhanh chóng</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Hệ thống đối soát tự động và đội ngũ hỗ trợ nhiệt tình
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>
            © {new Date().getFullYear()} DIGISHOP Multi-Supplier Marketplace. Hệ
            thống phân phối sản phẩm số tự động.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/api-docs"
              className="text-primary font-semibold hover:underline"
            >
              Tài liệu API
            </Link>
            <Link href="/dieu-khoan-dich-vu" className="hover:underline">
              Điều khoản dịch vụ
            </Link>
            <Link href="/chinh-sach-bao-mat" className="hover:underline">
              Chính sách bảo mật
            </Link>
            <Link href="/huong-dan-mua-hang" className="hover:underline">
              Hướng dẫn mua hàng
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
