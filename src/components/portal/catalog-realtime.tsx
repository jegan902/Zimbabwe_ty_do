"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => source.close();
  }, [router]);

  return null;
}
