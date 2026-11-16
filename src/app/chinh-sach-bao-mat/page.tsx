import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  Eye,
  Database,
  Users,
  Cookie,
  ArrowRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Chính Sách Bảo Mật | DIGISHOP",
  description:
    "Tìm hiểu cách DIGISHOP thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn khi sử dụng dịch vụ mua bán tài khoản số.",
};

const sections = [
  {
    id: "thu-thap",
    icon: Database,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "1. Thông tin chúng tôi thu thập",
    content: [
      {
        sub: "Thông tin tài khoản",
        text: "Khi bạn đăng ký, chúng tôi lưu trữ địa chỉ email, tên hiển thị (nếu bạn cung cấp) và mật khẩu đã được băm (hash) bằng thuật toán bcrypt. Chúng tôi không bao giờ lưu mật khẩu dưới dạng văn bản thường.",
      },
      {
        sub: "Thông tin giao dịch",
        text: "Khi bạn thực hiện giao dịch, chúng tôi lưu lại lịch sử nạp tiền, lịch sử đặt hàng, số dư ví và nhật ký trừ tiền. Dữ liệu này cần thiết để đảm bảo tính chính xác và minh bạch của mỗi giao dịch.",
      },
      {
        sub: "Thông tin kỹ thuật",
        text: "Địa chỉ IP, trình duyệt, thời gian đăng nhập và session token (lưu trong cookie httpOnly) được thu thập nhằm mục đích bảo mật, phát hiện đăng nhập bất thường và ngăn chặn gian lận.",
      },
    ],
  },
  {
    id: "su-dung",
    icon: Eye,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    title: "2. Mục đích sử dụng thông tin",
    content: [
      {
        sub: "Cung cấp dịch vụ",
        text: "Thông tin được dùng để xác thực danh tính, xử lý giao dịch, bàn giao sản phẩm và hiển thị lịch sử đơn hàng của bạn.",
      },
      {
        sub: "Bảo mật hệ thống",
        text: "Chúng tôi phân tích hành vi đăng nhập để phát hiện truy cập trái phép, tự động khóa tài khoản nếu phát hiện bất thường và thông báo cho bạn.",
      },
      {
        sub: "Cải thiện dịch vụ",
        text: "Dữ liệu tổng hợp (ẩn danh) về sản phẩm được mua nhiều, lỗi thường gặp được dùng để nâng cao trải nghiệm người dùng. Chúng tôi không bao giờ bán dữ liệu cá nhân cho bên thứ ba vì mục đích thương mại.",
      },
    ],
  },
  {
    id: "bao-mat",
    icon: Lock,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "3. Cách chúng tôi bảo vệ dữ liệu",
    content: [
      {
        sub: "Mã hóa truyền tải",
        text: "Toàn bộ kết nối đến DIGISHOP sử dụng HTTPS/TLS. Thông tin tài khoản bàn giao trong đơn hàng được mã hóa AES-256 trước khi lưu vào cơ sở dữ liệu.",
      },
      {
        sub: "Xác thực phiên làm việc",
        text: "Session token được lưu trong cookie httpOnly (không thể đọc bởi JavaScript) và tự động hết hạn sau thời gian không hoạt động. Mỗi lần đăng nhập tạo một session mới.",
      },
      {
        sub: "Quyền truy cập nội bộ",
        text: "Chỉ nhân viên có thẩm quyền mới được truy cập dữ liệu người dùng, và chỉ khi cần thiết để xử lý khiếu nại. Mọi truy cập đều được ghi nhật ký (audit log).",
      },
    ],
  },
  {
    id: "chia-se",
    icon: Users,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "4. Chia sẻ thông tin với bên thứ ba",
    content: [
      {
        sub: "Nhà cung cấp dịch vụ thanh toán",
        text: "Khi bạn nạp tiền qua chuyển khoản ngân hàng, hệ thống SePay sẽ nhận thông tin giao dịch (số tiền, nội dung chuyển khoản) để xác minh. Chúng tôi không chia sẻ email hay mật khẩu với bên này.",
      },
      {
        sub: "Nhà cung cấp sản phẩm",
        text: "Khi bạn đặt hàng, hệ thống gửi yêu cầu tới nhà cung cấp để lấy thông tin tài khoản. Dữ liệu gửi đi chỉ gồm SKU sản phẩm và số lượng — không có thông tin cá nhân của bạn.",
      },
      {
        sub: "Yêu cầu pháp lý",
        text: "Chúng tôi có thể cung cấp thông tin cho cơ quan pháp luật khi có yêu cầu hợp pháp theo quy định pháp luật Việt Nam hiện hành.",
      },
    ],
  },
  {
    id: "cookie",
    icon: Cookie,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    title: "5. Cookie & lưu trữ trình duyệt",
    content: [
      {
        sub: "Cookie phiên đăng nhập",
        text: "Chúng tôi chỉ dùng một cookie httpOnly duy nhất để lưu session token. Cookie này không chứa thông tin cá nhân và tự hết hạn khi bạn đăng xuất hoặc sau thời gian quy định.",
      },
      {
        sub: "Không có cookie theo dõi",
        text: "DIGISHOP không sử dụng Google Analytics, Facebook Pixel hay bất kỳ cookie theo dõi quảng cáo nào. Chúng tôi không theo dõi hành vi duyệt web của bạn trên các trang khác.",
      },
    ],
  },
  {
    id: "quyen",
    icon: Shield,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    title: "6. Quyền của bạn đối với dữ liệu",
    content: [
      {
        sub: "Quyền truy cập & chỉnh sửa",
        text: "Bạn có thể xem và chỉnh sửa thông tin hồ sơ (tên, mật khẩu) bất cứ lúc nào tại trang Tài khoản của tôi.",
      },
      {
        sub: "Quyền xóa tài khoản",
        text: "Bạn có thể yêu cầu xóa tài khoản bằng cách liên hệ với chúng tôi. Dữ liệu giao dịch có thể được giữ lại tối đa 5 năm theo quy định kế toán và pháp luật.",
      },
      {
        sub: "Quyền khiếu nại",
        text: "Nếu bạn tin rằng dữ liệu của mình bị xử lý sai, bạn có quyền liên hệ trực tiếp với chúng tôi hoặc khiếu nại tới cơ quan bảo vệ dữ liệu có thẩm quyền.",
      },
    ],
  },
];

export default function ChinhSachBaoMatPage() {
  const updatedAt = "16/11/2026";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-500/8 via-background to-background border-b">
        <div className="container mx-auto px-4 sm:px-8 py-16 text-center space-y-5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Shield className="h-3.5 w-3.5" /> Chính sách bảo mật
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
            Chúng Tôi Bảo Vệ{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              Dữ Liệu Của Bạn
            </span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            DIGISHOP cam kết bảo mật thông tin cá nhân theo tiêu chuẩn cao
            nhất. Tài liệu này giải thích rõ chúng tôi thu thập gì, dùng để
            làm gì và bảo vệ như thế nào.
          </p>
          <p className="text-xs text-muted-foreground">
            Cập nhật lần cuối:{" "}
            <span className="font-semibold text-foreground">{updatedAt}</span>
          </p>
        </div>
      </section>

      {/* Table of contents */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 sm:px-8 py-6 max-w-3xl">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Nội dung
          </p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-semibold text-primary hover:underline bg-primary/5 border border-primary/20 rounded-full px-3 py-1 transition-colors hover:bg-primary/10"
              >
                {s.title.split(". ")[1]}
              </a>
            ))}
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
              <div className="space-y-4 pl-12">
                {section.content.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {item.sub}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Warning notice */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">Lưu ý quan trọng</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Chính sách bảo mật này có thể được cập nhật theo thời gian khi
              dịch vụ thay đổi hoặc có yêu cầu pháp lý mới. Chúng tôi sẽ thông
              báo về những thay đổi quan trọng qua email hoặc thông báo trên
              trang web. Tiếp tục sử dụng dịch vụ sau khi thay đổi có nghĩa là
              bạn chấp nhận chính sách mới.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t bg-gradient-to-b from-muted/30 to-background py-14">
        <div className="container mx-auto px-4 sm:px-8 text-center max-w-xl space-y-5">
          <Mail className="h-10 w-10 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-black">Liên hệ về quyền riêng tư</h2>
          <p className="text-sm text-muted-foreground">
            Nếu bạn có câu hỏi về chính sách bảo mật hoặc muốn thực hiện quyền
            đối với dữ liệu, hãy liên hệ với chúng tôi qua email hỗ trợ.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild className="font-bold gap-1.5">
              <Link href="/dieu-khoan-dich-vu">
                Điều khoản dịch vụ <ArrowRight className="h-4 w-4" />
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
