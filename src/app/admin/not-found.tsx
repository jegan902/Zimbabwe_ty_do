import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h1 className="text-4xl font-black">404</h1>
      <h2 className="text-lg font-bold">Không tìm thấy trang</h2>
      <img
        src="/images/404.jpg"
        alt="404"
        width={500}
        height={500}
        style={{ display: "block", border: "1px solid red" }}
      />
      <p className="text-xs text-muted-foreground max-w-sm">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Button asChild size="sm">
        <Link href="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
