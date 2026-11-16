import type { Metadata } from "next";
import Link from "next/link";
import {
  UserPlus,
  Wallet,
  ShoppingCart,
  Zap,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  ArrowRight,
  Info,
  CreditCard,
  Package,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Hướng Dẫn Mua Hàng | DIGISHOP",
  description:
    "Hướng dẫn chi tiết từng bước cách mua tài khoản số trên DIGISHOP: đăng ký, nạp tiền, đặt hàng và nhận tài khoản tự động tức thì.",
};

const steps = [
  {
    icon: UserPlus,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    num: "01",
    title: "Tạo tài khoản",
    desc: "Đăng ký tài khoản miễn phí bằng email của bạn. Chỉ cần email hợp lệ, không cần xác minh CCCD hay số điện thoại.",
    sub: [
      "Truy cập trang Đăng ký",
      "Điền email & mật khẩu",
      "Nhận email xác nhận (nếu có) và đăng nhập",
    ],
    link: "/register",
    linkLabel: "Đăng ký ngay",
  },
  {
    icon: Wallet,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    num: "02",
    title: "Nạp tiền vào ví",
    desc: "DIGISHOP sử dụng hệ thống ví nội bộ. Bạn cần nạp tiền vào ví trước khi mua hàng. Chúng tôi hỗ trợ chuyển khoản ngân hàng qua mã QR (SePay tự động).",
    sub: [
      "Vào trang Nạp tiền tại mục Ví của tôi",
      "Chọn số tiền muốn nạp",
      "Quét mã QR bằng app ngân hàng",
      "Tiền vào ví tự động trong vài giây",
    ],
    link: "/wallet",
    linkLabel: "Nạp tiền ngay",
  },
  {
    icon: ShoppingCart,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    num: "03",
    title: "Chọn sản phẩm & đặt hàng",
    desc: "Duyệt danh mục sản phẩm, chọn loại tài khoản bạn muốn mua và nhấn Mua ngay. Hệ thống sẽ kiểm tra giá nhập mới nhất từ nhà cung cấp trước khi trừ tiền.",
    sub: [
      "Vào trang Sản phẩm hoặc dùng tìm kiếm",
      "Nhấn Mua ngay trên sản phẩm",
      "Xác nhận giá & số lượng",
      "Hệ thống tự động trừ ví và xử lý",
    ],
    link: "/products",
    linkLabel: "Xem sản phẩm",
  },
  {
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    num: "04",
    title: "Nhận tài khoản tức thì",
    desc: "Sau khi đặt hàng thành công, hệ thống sẽ tự động bàn giao thông tin tài khoản ngay lập tức — không cần chờ nhân viên duyệt. Toàn bộ nội dung được mã hóa an toàn.",
    sub: [
      "Thông tin tài khoản hiện ngay trên trang đơn hàng",
      "Bạn có thể xem lại bất cứ lúc nào tại mục Đơn hàng",
      "Mỗi đơn hàng có trạng thái chi tiết: Đang xử lý / Thành công / Lỗi",
    ],
    link: "/orders",
    linkLabel: "Xem đơn hàng của tôi",
  },
];

const faqs = [
  {
    q: "Tôi đã nạp tiền nhưng ví chưa cập nhật?",
    a: "Hệ thống tự động xử lý trong vòng 1–2 phút. Nếu quá 5 phút vẫn chưa thấy, vui lòng kiểm tra lại nội dung chuyển khoản phải khớp đúng mã giao dịch và liên hệ hỗ trợ.",
  },
  {
    q: "Mua xong nhưng không thấy thông tin tài khoản?",
    a: "Vào mục Đơn hàng của tôi, tìm mã đơn hàng và nhấn Xem chi tiết. Nếu trạng thái là Thất bại hoặc Lỗi, tiền sẽ được hoàn lại tự động vào ví của bạn.",
  },
  {
    q: "Tài khoản tôi mua có bị lỗi / không đăng nhập được không?",
    a: "Chúng tôi không kiểm soát nội dung tài khoản sau khi bàn giao. Mọi khiếu nại liên quan đến chất lượng tài khoản phụ thuộc vào nhà cung cấp. Vui lòng liên hệ hỗ trợ trong vòng 24 giờ sau khi mua.",
  },
  {
    q: "Tôi có thể hoàn tiền không?",
    a: "Chính sách hoàn tiền tùy từng loại sản phẩm và do nhà cung cấp quy định. Vui lòng đọc mô tả sản phẩm trước khi mua và liên hệ hỗ trợ nếu có vấn đề.",
  },
  {
    q: "DIGISHOP có hỗ trợ mua số lượng lớn / API không?",
    a: "Có. Bạn có thể mua nhiều hơn 1 đơn vị cho cùng một sản phẩm trong một lần đặt. Nếu cần đặt hàng API tự động với số lượng lớn, vui lòng xem tài liệu API của chúng tôi.",
  },
];

export default function HuongDanMuaHangPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/8 via-background to-background border-b">
        <div className="container mx-auto px-4 sm:px-8 py-16 text-center space-y-5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Info className="h-3.5 w-3.5" /> Hướng dẫn mua hàng
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
            Mua Tài Khoản Số Dễ Dàng,{" "}
            <span className="text-primary">Chỉ 4 Bước Đơn Giản</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Từ đăng ký đến nhận tài khoản chỉ mất vài phút. Hệ thống xử lý
            hoàn toàn tự động, không cần chờ nhân viên.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="container mx-auto px-4 sm:px-8 py-14 max-w-4xl">
        <div className="space-y-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="flex gap-5 sm:gap-8 p-6 rounded-2xl border bg-card shadow-xs hover:shadow-sm transition-shadow"
              >
                {/* Step number + icon */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div
                    className={`h-12 w-12 rounded-2xl ${step.bg} flex items-center justify-center`}
                  >
                    <Icon className={`h-6 w-6 ${step.color}`} />
                  </div>
                  <span className="text-[11px] font-black text-muted-foreground/60 tracking-widest">
                    {step.num}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-3 min-w-0">
                  <h2 className="text-lg font-black text-foreground">
                    {step.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                  <ul className="space-y-1.5">
                    {step.sub.map((s, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 text-xs text-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold gap-1 h-8"
                      asChild
                    >
                      <Link href={step.link}>
                        {step.linkLabel}{" "}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Payment Info */}
      <section className="bg-muted/40 border-y py-14">
        <div className="container mx-auto px-4 sm:px-8 max-w-4xl">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Phương thức nạp tiền được hỗ trợ
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-card p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-sm">
                  Chuyển khoản ngân hàng (QR)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quét mã QR bằng bất kỳ app ngân hàng nào hỗ trợ VietQR
                (Vietcombank, MB Bank, TPBank, Techcombank…). Tiền vào ví trong
                5–60 giây nhờ hệ thống SePay tự động.
              </p>
              <p className="text-xs text-emerald-600 font-semibold">
                ✓ Không phí giao dịch
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-5 space-y-2 opacity-60">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-sm text-muted-foreground">
                  Ví điện tử (Sắp có)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hỗ trợ MoMo, ZaloPay, VNPay đang trong quá trình tích hợp. Dự
                kiến ra mắt trong thời gian tới.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 sm:px-8 py-14 max-w-3xl">
        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Câu hỏi thường gặp
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 space-y-2">
              <h3 className="font-bold text-sm flex items-start gap-2">
                <span className="text-primary font-black shrink-0">Q.</span>
                {faq.q}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-b from-muted/30 to-background py-14">
        <div className="container mx-auto px-4 sm:px-8 text-center max-w-xl space-y-5">
          <MessageCircle className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-xl font-black">Vẫn còn thắc mắc?</h2>
          <p className="text-sm text-muted-foreground">
            Đội ngũ hỗ trợ của chúng tôi sẵn sàng giải đáp mọi câu hỏi. Liên
            hệ qua fanpage, email hoặc nhóm Telegram hỗ trợ.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild className="font-bold gap-1.5">
              <Link href="/products">
                Mua hàng ngay <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="font-semibold">
              <Link href="/register">Đăng ký tài khoản</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
