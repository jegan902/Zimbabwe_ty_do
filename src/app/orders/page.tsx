import { OrdersListClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <div className="container mx-auto px-4 py-10 sm:px-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">Lịch sử đơn hàng</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Xem lại tất cả đơn hàng đã mua và thông tin tài khoản đã được bàn giao.
        </p>
      </div>

      <OrdersListClient />
    </div>
  );
}

