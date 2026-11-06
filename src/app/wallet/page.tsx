import { WalletClient } from "./wallet-client";

export const dynamic = "force-dynamic";

export default function WalletPage() {
  return (
    <div className="container mx-auto px-4 py-10 sm:px-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">Ví & Nạp tiền tự động</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Nạp tiền qua VietQR tự động cộng vào ví trong 5 giây, bảo mật và đối soát chính xác.
        </p>
      </div>

      <WalletClient />
    </div>
  );
}

