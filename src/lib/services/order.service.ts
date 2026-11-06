import { prisma } from "@/lib/utils/db";
import { resolveSupplier } from "@/lib/suppliers/registry";
import { reserveFunds, captureFunds, releaseFunds } from "@/lib/wallet/wallet.service";
import { d, computeSellingPrice } from "@/lib/utils/money";
import { encryptData, decryptData } from "@/lib/utils/crypto";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { realtimeBus } from "@/lib/realtime/bus";
import logger from "@/lib/utils/logger";

export interface CheckoutInput {
  userId: string;
  productId: string;
  quantity?: number;
  confirmedPrice?: string;
}

export interface CredentialItem {
  position: number;
  raw: string;
  username?: string;
  password?: string;
}

export interface OrderDetailResult {
  id: string;
  orderCode: string;
  product: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  };
  quantity: number;
  sellingPrice: string;
  totalAmount: string;
  status: string;
  deliveredQuantity: number;
  credentials: CredentialItem[];
  createdAt: Date;
  completedAt: Date | null;
}

export async function checkoutDirect(input: CheckoutInput) {
  const quantity = Math.max(1, Math.min(10, input.quantity || 1));

  // 1. Fetch Product and its Active Mappings
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: {
      mappings: {
        where: { isActive: true },
        include: {
          supplierProduct: {
            include: { supplier: true },
          },
        },
        orderBy: [{ priority: "asc" }, { supplierProduct: { supplierCost: "asc" } }],
      },
    },
  });

  if (!product || product.status !== "ACTIVE" || product.isHidden) {
    throw new NotFoundError("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh");
  }

  const activeMappings = product.mappings.filter(
    (m: any) => m.supplierProduct?.supplier?.status === "ACTIVE"
  );
  const mapping = activeMappings[0];
  if (!mapping) {
    throw new ConflictError("Sản phẩm hiện tạm hết nguồn cung cấp khả dụng");
  }

  // 2. Pre-purchase Revalidation from Supplier Adapter
  const { supplier, adapter, context } = await resolveSupplier(mapping.supplierId);
  let currentCost = d(mapping.supplierProduct.supplierCost.toString());

  try {
    const liveProd = await adapter.getProduct(context, mapping.supplierProduct.supplierProductId);
    if (!liveProd.isActive) {
      throw new ConflictError("Sản phẩm tạm thời không khả dụng tại nhà cung cấp");
    }
    currentCost = d(liveProd.cost);
  } catch (err) {
    if (err instanceof ConflictError) throw err;
    logger.warn({ err }, "Could not fetch live product before checkout, using cached cost");
  }

  // 3. Compute Selling Price
  const unitSellingPrice =
    product.pricingMode === "AUTO"
      ? computeSellingPrice(
          currentCost,
          product.profitType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
          product.profitValue.toString()
        )
      : d(product.sellingPrice.toString());

  if (input.confirmedPrice && !d(input.confirmedPrice).equals(unitSellingPrice)) {
    throw new ConflictError("Giá sản phẩm vừa thay đổi", {
      newPrice: unitSellingPrice.toFixed(2),
    });
  }

  const totalAmount = unitSellingPrice.times(quantity);
  const totalCost = currentCost.times(quantity);
  const profit = totalAmount.minus(totalCost);

  // 4. Check Supplier Balance if tracked
  const supplierBalance = await prisma.supplierBalance.findUnique({
    where: { supplierId: supplier.id },
  });
  if (supplier.supportsBalanceApi && supplierBalance) {
    const currentBal = d(supplierBalance.balance.toString());
    if (currentBal.lessThan(totalCost)) {
      throw new ConflictError("Hệ thống đang bảo trì nguồn hàng, vui lòng thử lại sau ít phút");
    }
  }

  // 5. Generate Order Code and Reserve Funds
  const orderCode = `DH${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      orderCode,
      userId: input.userId,
      productId: product.id,
      supplierId: supplier.id,
      supplierProductId: mapping.supplierProduct.supplierProductId,
      quantity,
      supplierCost: currentCost.toFixed(2),
      sellingPrice: unitSellingPrice.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      profit: profit.toFixed(2),
      status: "PENDING",
    },
  });

  await reserveFunds({
    userId: input.userId,
    orderId: order.id,
    amount: totalAmount,
    idempotencyKey: `order-reserve-${order.id}`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PROCESSING" },
  });

  // 6. Call Supplier Adapter
  let outcome;
  try {
    outcome = await adapter.buyProduct(context, {
      supplierProductId: mapping.supplierProduct.supplierProductId,
      quantity,
      reference: order.orderCode,
    });
  } catch (err) {
    logger.error({ err }, "Exception when calling supplier buyProduct");
    outcome = {
      status: "UNKNOWN" as const,
      errorCode: "HTTP_EXCEPTION",
      message: err instanceof Error ? err.message : "Mất kết nối với nhà cung cấp",
      raw: null,
    };
  }

  // 7. Handle Result
  if (outcome.status === "SUCCESS") {
    await captureFunds({
      userId: input.userId,
      orderId: order.id,
      amount: totalAmount,
      description: `Thanh toán đơn hàng ${order.orderCode}`,
    });

    const parsedCredentials: CredentialItem[] = [];

    for (let i = 0; i < outcome.credentials.length; i++) {
      const rawCred = outcome.credentials[i];
      await prisma.orderCredential.create({
        data: {
          orderId: order.id,
          position: i + 1,
          encryptedData: encryptData(rawCred),
        },
      });

      const parts = rawCred.split("|");
      parsedCredentials.push({
        position: i + 1,
        raw: rawCred,
        username: parts[0]?.trim(),
        password: parts[1]?.trim(),
      });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "SUCCESS",
        supplierTransId: outcome.supplierOrderId,
        deliveredQuantity: outcome.credentials.length,
        capturedAmount: totalAmount.toFixed(2),
        completedAt: new Date(),
      },
    });

    if (supplierBalance) {
      await prisma.supplierBalance.update({
        where: { supplierId: supplier.id },
        data: {
          balance: d(supplierBalance.balance.toString()).minus(totalCost).toFixed(2),
          totalSpent: d(supplierBalance.totalSpent.toString()).plus(totalCost).toFixed(2),
        },
      });
    }

    realtimeBus.publish({
      type: "order.updated",
      orderId: order.id,
      userId: input.userId,
      payload: { status: "SUCCESS", orderCode },
    });

    return {
      orderCode: order.orderCode,
      status: "SUCCESS",
      totalAmount: totalAmount.toFixed(2),
      credentials: parsedCredentials,
    };
  } else if (outcome.status === "FAILED") {
    await releaseFunds({
      userId: input.userId,
      orderId: order.id,
      reason: outcome.message,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        errorCode: outcome.errorCode,
        errorDetails: outcome.message,
      },
    });

    throw new ConflictError(`Đặt hàng không thành công: ${outcome.message}`);
  } else {
    // UNKNOWN - Must Reconcile, DO NOT release, DO NOT double charge
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "RECONCILIATION",
        errorCode: outcome.errorCode,
        reconciliationNote: outcome.message,
      },
    });

    realtimeBus.publish({
      type: "order.updated",
      orderId: order.id,
      userId: input.userId,
      payload: { status: "RECONCILIATION", orderCode },
    });

    throw new ConflictError(
      "Đơn hàng đang chờ đối soát kết quả với nhà cung cấp. Vui lòng kiểm tra lại trong lịch sử đơn hàng sau ít phút."
    );
  }
}

export async function getOrderDetails(
  userId: string,
  orderCode: string,
  isAdmin = false
): Promise<OrderDetailResult> {
  const order = await prisma.order.findUnique({
    where: { orderCode },
    include: {
      product: {
        select: { id: true, name: true, slug: true, image: true },
      },
      credentials: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!order) throw new NotFoundError("Đơn hàng");
  if (!isAdmin && order.userId !== userId) {
    throw new NotFoundError("Đơn hàng");
  }

  const credentials: CredentialItem[] = [];
  if (order.status === "SUCCESS") {
    for (const c of order.credentials) {
      try {
        const decrypted = decryptData(c.encryptedData);
        const parts = decrypted.split("|");
        credentials.push({
          position: c.position,
          raw: decrypted,
          username: parts[0]?.trim(),
          password: parts[1]?.trim(),
        });
      } catch (e) {
        logger.error({ err: e }, "Failed to decrypt credential for order");
      }
    }
  }

  return {
    id: order.id,
    orderCode: order.orderCode,
    product: order.product,
    quantity: order.quantity,
    sellingPrice: order.sellingPrice.toString(),
    totalAmount: order.totalAmount.toString(),
    status: order.status,
    deliveredQuantity: order.deliveredQuantity,
    credentials,
    createdAt: order.createdAt,
    completedAt: order.completedAt,
  };
}

export async function listUserOrders(userId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        product: {
          select: { id: true, name: true, slug: true, image: true },
        },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return {
    items: items.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      product: o.product,
      quantity: o.quantity,
      totalAmount: o.totalAmount.toString(),
      status: o.status,
      deliveredQuantity: o.deliveredQuantity,
      createdAt: o.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
