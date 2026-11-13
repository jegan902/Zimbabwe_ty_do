"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Subscribes to /api/realtime and refreshes the page when supplier sync finishes
 * so mirrored catalog changes appear without a manual reload.
 */
export function CatalogRealtime() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/realtime");

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type === "product.synced" || data.type === "product.updated") {
          router.refresh();
          // toast.info("Dữ liệu sản phẩm & giá vừa được cập nhật tự động!", {
          //   id: "realtime-catalog-refresh",
          //   duration: 3000,
          // });
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => source.close();
  }, [router]);

  return null;
}
