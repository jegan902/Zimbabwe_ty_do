import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Scale,
  ShieldCheck,
  ArrowRight,
  HandshakeIcon,
  Info,
  Ban,
  Gavel,
  Clock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Điều Khoản Dịch Vụ | DIGISHOP",
  description:
    "Điều khoản và điều kiện sử dụng dịch vụ DIGISHOP - nền tảng mua bán tài khoản số tự động đa nhà cung cấp.",
};

const sections = [
  {
    id: "chap-nhan",
    icon: HandshakeIcon,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "1. Chấp nhận điều khoản",
    paragraphs: [
      "Bằng cách truy cập và sử dụng DIGISHOP, bạn xác nhận rằng bạn đã đọc, hiểu và đồng ý tuân thủ các điều khoản dịch vụ này.",
      "Nếu bạn không đồng ý với bất kỳ điều khoản nào, bạn không được phép sử dụng dịch vụ của chúng tôi. Chúng tôi có quyền thay đổi điều khoản bất kỳ lúc nào và sẽ thông báo qua email hoặc thông báo trên trang web.",
      "Việc tiếp tục sử dụng dịch vụ sau khi điều khoản được cập nhật đồng nghĩa với việc bạn chấp nhận các điều khoản mới.",
    ],
  },
  {
    id: "dich-vu",
    icon: Info,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    title: "2. Mô tả dịch vụ",
    paragraphs: [
      "DIGISHOP là nền tảng trung gian kết nối người mua với các nhà cung cấp tài khoản số (tài khoản dịch vụ streaming, phần mềm, game, v.v.). Chúng tôi không tự sản xuất hay sở hữu các tài khoản được bán.",
      "Hệ thống xử lý thanh toán qua ví nội bộ, kết nối API với nhà cung cấp và tự động bàn giao thông tin tài khoản ngay sau khi giao dịch thành công — không cần can thiệp thủ công.",
      "DIGISHOP hoạt động 24/7, nhưng có thể tạm dừng để bảo trì hoặc khi nhà cung cấp gặp sự cố. Chúng tôi sẽ thông báo trước khi bảo trì nếu có thể.",
    ],
  },
  {
    id: "tai-khoan",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "3. Tài khoản người dùng",
    paragraphs: [
      "Mỗi người dùng được phép đăng ký một tài khoản. Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động xảy ra dưới tài khoản của mình.",
      "Bạn cam kết cung cấp thông tin chính xác và cập nhật. Tài khoản đăng ký bằng thông tin giả mạo có thể bị xóa mà không cần thông báo trước.",
      "Bạn không được phép chia sẻ, bán hoặc chuyển nhượng tài khoản cho người khác. Nghiêm cấm đăng ký tài khoản nhằm mục đích lợi dụng các chương trình khuyến mãi.",
    ],
  },
  {
    id: "thanh-toan",
    icon: Scale,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "4. Thanh toán & ví nội bộ",
    paragraphs: [
      "Mọi giao dịch mua hàng trên DIGISHOP đều thực hiện qua ví nội bộ. Bạn cần nạp tiền trước vào ví trước khi mua hàng.",
      "Tiền trong ví DIGISHOP không phải tiền gửi ngân hàng và không được bảo hiểm tiền gửi. Hạn mức nạp tối thiểu và tối đa có thể thay đổi theo thời gian.",
      "Số tiền trong ví có thể được rút lại trong một số trường hợp đặc biệt theo yêu cầu — vui lòng liên hệ hỗ trợ. Chúng tôi không chịu trách nhiệm cho các khoản tiền nạp sai tài khoản hoặc sai nội dung chuyển khoản.",
    ],
  },
  {
    id: "cam-ket",
    icon: Ban,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    title: "5. Hành vi bị cấm",
    list: [
      "Sử dụng dịch vụ cho bất kỳ mục đích phi pháp nào",
      "Cố tình hack, khai thác lỗ hổng hoặc can thiệp vào hệ thống",
      "Mua hàng bằng thông tin thanh toán gian lận hoặc giả mạo",
      "Resell tài khoản mua được với mục đích thương mại mà không có sự cho phép",
      "Spam, quấy rối hoặc lạm dụng hệ thống hỗ trợ",
      "Tạo nhiều tài khoản để hưởng lợi từ các chương trình ưu đãi",
      "Reverse engineering, dịch ngược hoặc sao chép hệ thống DIGISHOP",
    ],
  },
  {
    id: "hoan-tien",
    icon: Clock,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    title: "6. Chính sách hoàn tiền",
    paragraphs: [
      "Khi đơn hàng thất bại do lỗi hệ thống hoặc nhà cung cấp, tiền sẽ được hoàn tự động vào ví DIGISHOP của bạn trong tối đa 15 phút.",
      "Chúng tôi không hoàn tiền trong trường hợp: thông tin tài khoản đã bàn giao nhưng bạn không dùng được do vấn đề từ phía dịch vụ đích (ví dụ: tài khoản bị nhà phát triển xóa), hoặc bạn đã thay đổi mật khẩu làm mất quyền truy cập.",
      "Khiếu nại liên quan đến chất lượng sản phẩm cần được gửi trong vòng 24 giờ sau khi mua. Sau thời gian này, chúng tôi không đảm bảo xử lý được khiếu nại.",
    ],
  },
  {
    id: "trach-nhiem",
    icon: Gavel,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    title: "7. Giới hạn trách nhiệm",
    paragraphs: [
      "DIGISHOP là nền tảng trung gian. Chúng tôi không chịu trách nhiệm về chất lượng, tính khả dụng hoặc nội dung của các tài khoản do nhà cung cấp bên thứ ba cung cấp.",
      "Chúng tôi không đảm bảo dịch vụ hoạt động liên tục, không có lỗi. Trách nhiệm tối đa của DIGISHOP trong bất kỳ trường hợp nào không vượt quá số tiền bạn đã thanh toán cho giao dịch liên quan.",
      "Chúng tôi không chịu trách nhiệm cho bất kỳ thiệt hại gián tiếp, đặc biệt hoặc ngẫu nhiên nào phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ.",
    ],
  },
  {
    id: "luat",
    icon: Scale,
    color: "text-gray-500",
    bg: "bg-gray-500/10",
    title: "8. Luật áp dụng & giải quyết tranh chấp",
    paragraphs: [
      "Các điều khoản này được điều chỉnh bởi luật pháp Cộng hòa Xã hội Chủ nghĩa Việt Nam.",
      "Mọi tranh chấp phát sinh từ việc sử dụng dịch vụ sẽ được ưu tiên giải quyết thông qua thương lượng trực tiếp. Nếu không đạt được thỏa thuận, tranh chấp sẽ được đưa ra tòa án có thẩm quyền tại Việt Nam.",
    ],
  },
];

export default function DieuKhoanDichVuPage() {
  const updatedAt = "16/11/2026";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-500/8 via-background to-background border-b">
        <div className="container mx-auto px-4 sm:px-8 py-16 text-center space-y-5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
            <FileText className="h-3.5 w-3.5" /> Điều khoản dịch vụ
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
            Điều Khoản Sử Dụng{" "}
            <span className="text-indigo-600 dark:text-indigo-400">
              DIGISHOP
            </span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Vui lòng đọc kỹ các điều khoản này trước khi sử dụng dịch vụ. Việc
            sử dụng dịch vụ đồng nghĩa bạn đã chấp nhận toàn bộ các điều khoản
            được nêu dưới đây.
          </p>
          <p className="text-xs text-muted-foreground">
            Có hiệu lực từ:{" "}
            <span className="font-semibold text-foreground">{updatedAt}</span>
          </p>
        </div>
      </section>

      {/* Summary badges */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 sm:px-8 py-6 max-w-3xl">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Tóm tắt nhanh
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Thanh toán qua ví nội bộ, nạp tiền trước</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Hoàn tiền tự động khi đơn hàng lỗi hệ thống</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span>Không hoàn tiền sau khi tài khoản đã được bàn giao</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span>Nghiêm cấm dùng dịch vụ cho mục đích phi pháp</span>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 sm:px-8 py-14 max-w-3xl space-y-10">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} id={section.id} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className={`h-9 w-9 rounded-xl ${section.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`h-5 w-5 ${section.color}`} />
                </div>
                <h2 className="text-lg font-black text-foreground">
                  {section.title}
                </h2>
              </div>
              <div className="pl-12 space-y-4">
                {"paragraphs" in section &&
                  section.paragraphs?.map((p, i) => (
                    <p
                      key={i}
                      className="text-sm text-muted-foreground leading-relaxed"
                    >
                      {p}
                    </p>
                  ))}
                {"list" in section && (
                  <ul className="space-y-2">
                    {section.list?.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-foreground"
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}

        {/* Final notice */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">Liên hệ</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mọi câu hỏi liên quan đến Điều khoản Dịch vụ, vui lòng liên hệ
              với chúng tôi qua email hỗ trợ hoặc fanpage. Chúng tôi cam kết
              phản hồi trong vòng 24–48 giờ làm việc.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-b from-muted/30 to-background py-14">
        <div className="container mx-auto px-4 sm:px-8 text-center max-w-xl space-y-5">
          <Mail className="h-10 w-10 text-indigo-500 mx-auto" />
          <h2 className="text-xl font-black">Đọc thêm chính sách của chúng tôi</h2>
          <p className="text-sm text-muted-foreground">
            Cùng với Điều khoản Dịch vụ, hãy đọc thêm Chính sách Bảo mật và
            Hướng dẫn Mua hàng để hiểu đầy đủ về cách DIGISHOP vận hành.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild className="font-bold gap-1.5">
              <Link href="/chinh-sach-bao-mat">
                Chính sách bảo mật <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="font-semibold">
              <Link href="/huong-dan-mua-hang">
                <FileText className="h-4 w-4 mr-1.5" />
                Hướng dẫn mua hàng
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
