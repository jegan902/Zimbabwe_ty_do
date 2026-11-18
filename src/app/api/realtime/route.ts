import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { RealtimeBus, realtimeBus } from "@/lib/realtime/bus";
import { initInProcessSyncWorker } from "@/lib/jobs/supplier-sync.scheduler";
import { getClientIp } from "@/lib/utils/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_STREAMS_PER_USER = 3;
const MAX_STREAMS_PER_IP = 10;

/**
 * In-process stream counter. Edge/WAF limits still own global abuse control; this keeps a
 * single instance from being exhausted by one client opening hundreds of SSE connections.
 */
const openStreams = new Map<string, number>();

function acquire(key: string, limit: number): boolean {
  const current = openStreams.get(key) ?? 0;
  if (current >= limit) return false;
  openStreams.set(key, current + 1);
  return true;
}

function release(key: string): void {
  const current = openStreams.get(key) ?? 0;
  if (current <= 1) openStreams.delete(key);
  else openStreams.set(key, current - 1);
}

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

    const clientIp = getClientIp(request);
    const quotas: Array<[string, number]> = [];
    if (userId) quotas.push([`user:${userId}`, MAX_STREAMS_PER_USER]);
    quotas.push([`ip:${clientIp}`, MAX_STREAMS_PER_IP]);

    const acquired: string[] = [];
    for (const [key, limit] of quotas) {
      if (!acquire(key, limit)) {
        acquired.forEach(release);
        return new Response(
          JSON.stringify({
            success: false,
            error: "TOO_MANY_STREAMS",
            message:
              "Bạn đang mở quá nhiều kết nối realtime. Vui lòng đóng bớt tab.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "30",
            },
          },
        );
      }
      acquired.push(key);
    }

    let released = false;
    const releaseAll = () => {
      if (released) return;
      released = true;
      acquired.forEach(release);
    };

    // Assigned once the stream starts so `cancel()` can tear down the same resources the
    // abort listener does.
    let teardown: () => void = releaseAll;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
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
          releaseAll();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        teardown = abort;
        request.signal.addEventListener("abort", abort);
      },
      cancel() {
        teardown();
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
    // Never echo the stack trace: it is reachable without authentication.
    console.error("CRITICAL ERROR IN /api/realtime GET:", error);
    return new Response(
      JSON.stringify({ success: false, error: "REALTIME_UNAVAILABLE" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
