import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { d, money, roundMoney, computeProfit } from "@/lib/utils/money";
import { ConflictError, InsufficientFundsError, NotFoundError } from "@/lib/utils/errors";
import { pushEvent } from "@/lib/realtime/bus";

type Tx = Prisma.TransactionClient;

export interface WalletSnapshot {
  walletId: string;
  balance: string;
  reservedBalance: string;
  availableBalance: string;
  totalDeposits: string;
  totalSpent: string;
  totalRefunded: string;
}

function toSnapshot(wallet: {
  id: string;
  balance: Prisma.Decimal;
  reservedBalance: Prisma.Decimal;
  totalDeposits: Prisma.Decimal;
  totalSpent: Prisma.Decimal;
  totalRefunded: Prisma.Decimal;
}): WalletSnapshot {
  const balance = d(wallet.balance.toString());
  const reserved = d(wallet.reservedBalance.toString());
  return {
    walletId: wallet.id,
    balance: money(balance),
    reservedBalance: money(reserved),
    availableBalance: money(balance.minus(reserved)),
    totalDeposits: money(wallet.totalDeposits.toString()),
    totalSpent: money(wallet.totalSpent.toString()),
    totalRefunded: money(wallet.totalRefunded.toString()),
  };
}

export async function getOrCreateWallet(userId: string, tx: Tx | typeof prisma = prisma) {
  const existing = await tx.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.wallet.create({ data: { userId } });
}

export async function getWalletSnapshot(userId: string): Promise<WalletSnapshot> {
  const wallet = await getOrCreateWallet(userId);
  return toSnapshot(wallet);
}

/**
 * Locks the wallet row for the duration of the transaction.
 *
 * `SELECT ... FOR UPDATE` is what prevents two concurrent purchases from both
 * observing the same balance and overspending. Every balance mutation must go
 * through this helper.
 */
async function lockWallet(tx: Tx, userId: string) {
  const wallet = await getOrCreateWallet(userId, tx);
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundError("Ví");
  const locked = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
  return locked;
}

interface LedgerEntry {
  walletId: string;
  userId: string;
  transactionType:
    | "DEPOSIT"
    | "PURCHASE"
    | "REFUND"
    | "ADJUSTMENT"
    | "RESERVATION"
    | "CAPTURE"
    | "RELEASE";
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  reservedBefore: Prisma.Decimal;
  reservedAfter: Prisma.Decimal;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  description?: string | null;
  status?: "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";
}

function ledger(tx: Tx, entry: LedgerEntry) {
  return tx.walletTransaction.create({
    data: {
      walletId: entry.walletId,
      userId: entry.userId,
      transactionType: entry.transactionType,
      amount: entry.amount,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      reservedBefore: entry.reservedBefore,
      reservedAfter: entry.reservedAfter,
      referenceId: entry.referenceId ?? null,
      idempotencyKey: entry.idempotencyKey ?? null,
      description: entry.description ?? null,
      status: entry.status ?? "CONFIRMED",
    },
  });
}

/**
 * Credits a customer wallet. Used exclusively by verified payment settlement
 * and admin adjustments — never by anything the client can trigger directly.
 *
 * `idempotencyKey` is unique in the database, so a replayed webhook can never
 * credit the same deposit twice.
 */
export async function creditWallet(params: {
  userId: string;
  amount: Prisma.Decimal | string;
  transactionType: "DEPOSIT" | "ADJUSTMENT" | "REFUND";
  referenceId?: string;
  idempotencyKey?: string;
  description?: string;
}): Promise<WalletSnapshot> {
  const amount = roundMoney(params.amount.toString());
  if (!amount.isPositive()) throw new ConflictError("Số tiền phải lớn hơn 0");

  if (params.idempotencyKey) {
    const existing = await prisma.walletTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { id: existing.walletId },
      });
      return toSnapshot(wallet);
    }
  }

  const snapshot = await prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, params.userId);
    const before = d(wallet.balance.toString());
    const reservedBefore = d(wallet.reservedBalance.toString());
    const after = before.plus(amount);

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: after.toFixed(2),
        totalDeposits:
          params.transactionType === "DEPOSIT"
            ? d(wallet.totalDeposits.toString()).plus(amount).toFixed(2)
            : wallet.totalDeposits,
        totalRefunded:
          params.transactionType === "REFUND"
            ? d(wallet.totalRefunded.toString()).plus(amount).toFixed(2)
            : wallet.totalRefunded,
      },
    });

    await ledger(tx, {
      walletId: wallet.id,
      userId: params.userId,
      transactionType: params.transactionType,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      reservedBefore,
      reservedAfter: reservedBefore,
      referenceId: params.referenceId ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      description: params.description ?? null,
    });

    return toSnapshot(updated);
  });

  pushEvent({
    type: "wallet.updated",
    userId: params.userId,
    payload: { availableBalance: snapshot.availableBalance },
  });

  return snapshot;
}

/**
 * Reserves money for an order.
 *
 * The balance is not reduced: it stays the customer's money but becomes
 * unavailable. This lets a failed purchase release the hold without ever
 * having "removed" funds, which keeps the ledger auditable.
 */
export async function reserveFunds(params: {
  userId: string;
  orderId: string;
  amount: Prisma.Decimal | string;
  idempotencyKey?: string;
}): Promise<WalletSnapshot> {
  const amount = roundMoney(params.amount.toString());
  if (!amount.isPositive()) throw new ConflictError("Số tiền giữ chỗ phải lớn hơn 0");

  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, params.userId);
    const balance = d(wallet.balance.toString());
    const reservedBefore = d(wallet.reservedBalance.toString());
    const available = balance.minus(reservedBefore);

    if (available.lessThan(amount)) {
      throw new InsufficientFundsError(
        `Số dư khả dụng không đủ. Cần ${money(amount)}đ, hiện có ${money(available)}đ`
      );
    }

    // The unique constraint on orderId makes a duplicate reservation impossible
    // even if two requests race past the availability check.
    const existing = await tx.walletReservation.findUnique({
      where: { orderId: params.orderId },
    });
    if (existing) {
      throw new ConflictError("Đơn hàng đã được giữ tiền trước đó");
    }

    const reservedAfter = reservedBefore.plus(amount);

    await tx.walletReservation.create({
      data: {
        walletId: wallet.id,
        orderId: params.orderId,
        amount,
        status: "RESERVED",
      },
    });

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { reservedBalance: reservedAfter.toFixed(2) },
    });

    await ledger(tx, {
      walletId: wallet.id,
      userId: params.userId,
      transactionType: "RESERVATION",
      amount,
      balanceBefore: balance,
      balanceAfter: balance,
      reservedBefore,
      reservedAfter,
      referenceId: params.orderId,
      idempotencyKey: params.idempotencyKey ?? null,
      description: `Giữ tiền cho đơn hàng`,
    });

    return toSnapshot(updated);
  });
}

/**
 * Converts a reservation into a real charge.
 *
 * `amount` may be lower than the reservation when only part of the order could
 * be fulfilled; the remainder is returned by releasing the difference.
 */
export async function captureFunds(params: {
  userId: string;
  orderId: string;
  amount: Prisma.Decimal | string;
  description?: string;
}): Promise<WalletSnapshot> {
  const amount = roundMoney(params.amount.toString());

  const snapshot = await prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, params.userId);
    const reservation = await tx.walletReservation.findUnique({
      where: { orderId: params.orderId },
    });
    if (!reservation) throw new NotFoundError("Bản ghi giữ tiền");
    if (reservation.status === "CAPTURED") {
      throw new ConflictError("Đơn hàng đã được chốt tiền");
    }
    if (reservation.status === "RELEASED") {
      throw new ConflictError("Bản ghi giữ tiền đã được giải phóng");
    }
    if (amount.greaterThan(d(reservation.amount.toString()))) {
      throw new ConflictError("Số tiền chốt vượt quá số tiền đã giữ");
    }

    const balanceBefore = d(wallet.balance.toString());
    const reservedBefore = d(wallet.reservedBalance.toString());

    const releasedPortion = d(reservation.amount.toString()).minus(amount);
    const balanceAfter = balanceBefore.minus(amount);
    const reservedAfter = reservedBefore.minus(reservation.amount.toString());

    if (balanceAfter.isNegative()) {
      throw new InsufficientFundsError("Số dư ví không đủ để chốt giao dịch");
    }

    await tx.walletReservation.update({
      where: { orderId: params.orderId },
      data: { status: "CAPTURED", settledAt: new Date() },
    });

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: balanceAfter.toFixed(2),
        reservedBalance: reservedAfter.toFixed(2),
        totalSpent: d(wallet.totalSpent.toString()).plus(amount).toFixed(2),
      },
    });

    await ledger(tx, {
      walletId: wallet.id,
      userId: params.userId,
      transactionType: "CAPTURE",
      amount,
      balanceBefore,
      balanceAfter,
      reservedBefore,
      reservedAfter,
      referenceId: params.orderId,
      description: params.description ?? "Chốt tiền đơn hàng",
    });

    if (releasedPortion.isPositive()) {
      await ledger(tx, {
        walletId: wallet.id,
        userId: params.userId,
        transactionType: "RELEASE",
        amount: releasedPortion,
        balanceBefore: balanceAfter,
        balanceAfter,
        reservedBefore: reservedAfter.plus(releasedPortion),
        reservedAfter,
        referenceId: params.orderId,
        description: "Giải phóng phần tiền không dùng tới",
      });
    }

    return toSnapshot(updated);
  });

  pushEvent({
    type: "wallet.updated",
    userId: params.userId,
    payload: { availableBalance: snapshot.availableBalance },
  });

  return snapshot;
}

/** Drops a reservation without charging anything. */
export async function releaseFunds(params: {
  userId: string;
  orderId: string;
  reason?: string;
}): Promise<WalletSnapshot> {
  const snapshot = await prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, params.userId);
    const reservation = await tx.walletReservation.findUnique({
      where: { orderId: params.orderId },
    });
    if (!reservation) throw new NotFoundError("Bản ghi giữ tiền");
    if (reservation.status !== "RESERVED") {
      return toSnapshot(wallet);
    }

    const balance = d(wallet.balance.toString());
    const reservedBefore = d(wallet.reservedBalance.toString());
    const reservedAfter = reservedBefore.minus(reservation.amount.toString());

    await tx.walletReservation.update({
      where: { orderId: params.orderId },
      data: { status: "RELEASED", settledAt: new Date() },
    });

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { reservedBalance: (reservedAfter.isNegative() ? 0 : reservedAfter).toFixed(2) },
    });

    await ledger(tx, {
      walletId: wallet.id,
      userId: params.userId,
      transactionType: "RELEASE",
      amount: reservation.amount,
      balanceBefore: balance,
      balanceAfter: balance,
      reservedBefore,
      reservedAfter,
      referenceId: params.orderId,
      description: params.reason ?? "Giải phóng tiền giữ chỗ",
    });

    return toSnapshot(updated);
  });

  pushEvent({
    type: "wallet.updated",
    userId: params.userId,
    payload: { availableBalance: snapshot.availableBalance },
  });

  return snapshot;
}

/**
 * Refunds a settled order. Used only after a confirmed failure or an admin
 * decision, never automatically on an unknown supplier outcome.
 */
export async function refundOrder(params: {
  userId: string;
  orderId: string;
  amount: Prisma.Decimal | string;
  description?: string;
}): Promise<WalletSnapshot> {
  return creditWallet({
    userId: params.userId,
    amount: params.amount,
    transactionType: "REFUND",
    referenceId: params.orderId,
    description: params.description ?? "Hoàn tiền đơn hàng",
  });
}

export interface LedgerRow {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  status: string;
  description: string | null;
  referenceId: string | null;
  createdAt: Date;
}

export async function listWalletTransactions(
  userId: string,
  options: { page?: number; limit?: number; type?: string } = {}
): Promise<{ items: LedgerRow[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const where = {
    userId,
    ...(options.type
      ? { transactionType: options.type as LedgerEntry["transactionType"] }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      type: row.transactionType,
      amount: money(row.amount.toString()),
      balanceBefore: money(row.balanceBefore.toString()),
      balanceAfter: money(row.balanceAfter.toString()),
      status: row.status,
      description: row.description,
      referenceId: row.referenceId,
      createdAt: row.createdAt,
    })),
  };
}

/**
 * Allows administrators to manually adjust a user's wallet balance (credit or debit).
 * Guaranteed to be ACID-compliant with row lock and full ledger audit entry.
 */
export async function adjustWalletBalance(params: {
  userId: string;
  amount: Prisma.Decimal | string;
  operation: "ADD" | "SUBTRACT";
  reason: string;
  actorId?: string;
}): Promise<WalletSnapshot> {
  const amount = roundMoney(params.amount.toString());
  if (!amount.isPositive()) throw new ConflictError("Số tiền điều chỉnh phải lớn hơn 0");

  const snapshot = await prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, params.userId);
    const before = d(wallet.balance.toString());
    const reservedBefore = d(wallet.reservedBalance.toString());

    let after: ReturnType<typeof d>;
    if (params.operation === "ADD") {
      after = before.plus(amount);
    } else {
      const available = before.minus(reservedBefore);
      if (amount.greaterThan(available)) {
        throw new InsufficientFundsError(
          `Số dư khả dụng không đủ để trừ tiền. Hiện có ${money(available)}đ`
        );
      }
      after = before.minus(amount);
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: after.toFixed(2),
      },
    });

    await ledger(tx, {
      walletId: wallet.id,
      userId: params.userId,
      transactionType: "ADJUSTMENT",
      amount,
      balanceBefore: before,
      balanceAfter: after,
      reservedBefore,
      reservedAfter: reservedBefore,
      description: `[Điều chỉnh admin] ${params.operation === "ADD" ? "+ " : "- "}${money(amount)}đ: ${params.reason}`,
      referenceId: params.actorId ?? null,
    });

    return toSnapshot(updated);
  });

  pushEvent({
    type: "wallet.updated",
    userId: params.userId,
    payload: { availableBalance: snapshot.availableBalance },
  });

  return snapshot;
}

export { toSnapshot as walletSnapshot, computeProfit };