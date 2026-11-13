import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { RealtimeBus, realtimeBus } from "@/lib/realtime/bus";
import { initInProcessSyncWorker } from "@/lib/jobs/supplier-sync.scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE stream for catalog/order/wallet updates after supplier sync.
 * Frontend may listen and refresh product lists when `product.synced` fires.
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure the background sync worker is running in-process
    initInProcessSyncWorker();

    const user = await getUserFromRequest(request);
    const userId = user?.id ?? null;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send({ type: "connected", at: new Date().toISOString() });

        const unsubscribe = realtimeBus.subscribe((event) => {
          if (!RealtimeBus.visibleTo(event, userId, !!isAdmin)) return;
          send(event);
        });

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        }, 25_000);

        const abort = () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        request.signal.addEventListener("abort", abort);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("CRITICAL ERROR IN /api/realtime GET:", error);
    return new Response(JSON.stringify({ error: (error as Error).message, stack: (error as Error).stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
