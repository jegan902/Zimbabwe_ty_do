import { OrderResultClient } from "./order-client";

export const dynamic = "force-dynamic";

export default async function OrderResultPage({
  params,
}: {
  params: Promise<{ orderCode: string }>;
}) {
  const { orderCode } = await params;

  return (
    <div className="container mx-auto px-4 py-10 sm:px-8 max-w-3xl">
      <OrderResultClient orderCode={orderCode} />
    </div>
  );
}

