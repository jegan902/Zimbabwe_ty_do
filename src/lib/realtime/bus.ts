import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for realtime UI notifications.
 *
 * This is intentionally not Redis pub/sub: a single Node server instance owns
 * the SSE connections, and the synchronization pipeline runs in the same
 * process. If the deployment later scales horizontally, publish through Redis
 * and keep this module as the fan-out layer.
 */

export type RealtimeEvent =
  | { type: "product.updated"; productId: string; payload?: Record<string, unknown> }
  | { type: "product.synced"; supplierId: string; payload?: Record<string, unknown> }
  | { type: "order.updated"; orderId: string; userId: string; payload?: Record<string, unknown> }
  | { type: "wallet.updated"; userId: string; payload?: Record<string, unknown> }
  | { type: "supplier.balance"; supplierId: string; payload?: Record<string, unknown> }
  | { type: "sync.status"; supplierId: string; payload?: Record<string, unknown> };

class RealtimeBus {
  private emitter = new EventEmitter();

  constructor() {
    // Many storefront visitors can hold an SSE connection at once.
    this.emitter.setMaxListeners(0);
  }

  publish(event: RealtimeEvent): void {
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  /** Events are only sent to listeners allowed to see them. */
  static visibleTo(event: RealtimeEvent, userId: string | null, isAdmin: boolean): boolean {
    switch (event.type) {
      case "order.updated":
      case "wallet.updated":
        return isAdmin || event.userId === userId;
      case "product.updated":
      case "product.synced":
        return true;
      case "supplier.balance":
      case "sync.status":
        return isAdmin;
      default:
        return false;
    }
  }
}

const globalForBus = globalThis as unknown as { realtimeBus?: RealtimeBus };

export const realtimeBus = globalForBus.realtimeBus ?? new RealtimeBus();
if (process.env.NODE_ENV !== "production") {
  globalForBus.realtimeBus = realtimeBus;
}

/**
 * Fire-and-forget publish. A realtime notification must never make a financial
 * transaction fail, so publishing is always best-effort.
 */
export function pushEvent(event: RealtimeEvent): void {
  try {
    realtimeBus.publish(event);
  } catch {
    // Swallowed on purpose: UI notifications are not part of the ledger.
  }
}