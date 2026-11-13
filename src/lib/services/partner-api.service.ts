import { NextRequest } from "next/server";
import { authenticatePartnerApi } from "@/lib/auth/partner-api";
import { prisma } from "@/lib/utils/db";
import { checkoutDirect } from "@/lib/services/order.service";
import { decryptData } from "@/lib/utils/crypto";

export async function handleGetProfile(request: NextRequest) {
  const { auth, errorResponse } = await authenticatePartnerApi(request);
  if (errorResponse) return errorResponse;
  const { user, wallet } = auth!;

  return Response.json({
    status: "success",
    msg: "Lấy thông tin tài khoản thành công",
    data: {
      username: user.username,
      email: user.email,
      full_name: user.fullName || user.email,
      balance: wallet?.availableBalance ? Number(wallet.availableBalance) : 0,
      currency: wallet?.currency || "VND",
      ip_whitelist: user.ipWhitelist || "",
    },
    // Top-level fields for backwards compatibility with legacy PHP reseller scripts
    username: user.username,
    email: user.email,
    balance: wallet?.availableBalance ? Number(wallet.availableBalance) : 0,
    currency: wallet?.currency || "VND",
  });
}

export async function handleGetProducts(request: NextRequest) {
  const { auth, errorResponse } = await authenticatePartnerApi(request);
  if (errorResponse) return errorResponse;

  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: {
          status: "ACTIVE",
          isHidden: false,
          OR: [{ stock: null }, { stock: { gt: 0 } }],
        },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          sellingPrice: true,
          stock: true,
          description: true,
          image: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  // Flattened products list with category metadata
  const allProducts: any[] = [];
  const formattedCategories = categories.map((cat) => {
    const prods = cat.products.map((p) => {
      const item = {
        id: p.id,
        product_id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.sellingPrice),
        cost: Number(p.sellingPrice),
        stock: p.stock ?? 9999,
        amount: p.stock ?? 9999,
        description: p.description || "",
        image: p.image || "",
        status: p.status,
        category_id: cat.id,
        category_name: cat.name,
      };
      allProducts.push(item);
      return item;
    });

    return {
      id: cat.id,
      category_id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      description: cat.description,
      products: prods,
    };
  });

  return Response.json({
    status: "success",
    msg: "Lấy danh sách sản phẩm thành công",
    total_categories: formattedCategories.length,
    total_products: allProducts.length,
    categories: formattedCategories,
    products: allProducts,
    // data property format for standard clients
    data: formattedCategories,
  });
}

export async function handleGetProductDetail(request: NextRequest) {
  const { auth, errorResponse } = await authenticatePartnerApi(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const productId =
    url.searchParams.get("id") ||
    url.searchParams.get("product") ||
    url.searchParams.get("product_id") ||
    url.searchParams.get("productId");

  if (!productId) {
    return Response.json(
      { status: "error", msg: "Thiếu ID sản phẩm (tham số 'id' hoặc 'product')" },
      { status: 400 }
    );
  }

  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id: productId }, { slug: productId }],
      status: "ACTIVE",
      isHidden: false,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!product) {
    return Response.json(
      { status: "error", msg: "Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng kinh doanh" },
      { status: 404 }
    );
  }

  const payload = {
    id: product.id,
    product_id: product.id,
    name: product.name,
    slug: product.slug,
    price: Number(product.sellingPrice),
    cost: Number(product.sellingPrice),
    stock: product.stock ?? 9999,
    amount: product.stock ?? 9999,
    description: product.description || "",
    image: product.image || "",
    category_id: product.category?.id || null,
    category_name: product.category?.name || "",
    product_status: product.status,
  };

  return Response.json({
    ...payload,
    status: "success",
    msg: "Lấy chi tiết sản phẩm thành công",
    data: payload,
  });
}

export async function handleGetOrderDetail(request: NextRequest) {
  const { auth, errorResponse } = await authenticatePartnerApi(request);
  if (errorResponse) return errorResponse;
  const { user } = auth!;

  const url = new URL(request.url);
  const orderIdentifier =
    url.searchParams.get("id") ||
    url.searchParams.get("order") ||
    url.searchParams.get("order_code") ||
    url.searchParams.get("orderCode");

  if (!orderIdentifier) {
    return Response.json(
      { status: "error", msg: "Thiếu mã đơn hàng hoặc ID (tham số 'id' hoặc 'order')" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: {
      userId: user.id,
      OR: [{ id: orderIdentifier }, { orderCode: orderIdentifier }],
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
        },
      },
      credentials: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!order) {
    return Response.json(
      { status: "error", msg: "Không tìm thấy đơn hàng tương ứng với tài khoản này" },
      { status: 404 }
    );
  }

  const decryptedCredentials: string[] = [];
  for (const cred of order.credentials) {
    try {
      const raw = decryptData(cred.encryptedData);
      decryptedCredentials.push(raw);
    } catch {
      decryptedCredentials.push("[Lỗi giải mã thông tin]");
    }
  }

  const payload = {
    order_id: order.id,
    order_code: order.orderCode,
    product_id: order.productId,
    product_name: order.product.name,
    quantity: order.quantity,
    selling_price: Number(order.sellingPrice),
    total_amount: Number(order.totalAmount),
    status: order.status,
    created_at: order.createdAt,
    completed_at: order.completedAt,
    data: decryptedCredentials,
  };

  return Response.json({
    ...payload,
    status: "success",
    msg: "Lấy chi tiết đơn hàng thành công",
    data: payload,
  });
}

export async function handleBuyProduct(request: NextRequest) {
  // Extract parameters from form-data, urlencoded, JSON, or query parameters
  let action = "";
  let productId = "";
  let amount = 1;
  let coupon = "";
  let explicitApiKey: string | undefined = undefined;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const formData = await request.formData();
      action = (formData.get("action") as string) || "";
      productId =
        (formData.get("id") as string) ||
        (formData.get("product_id") as string) ||
        (formData.get("productId") as string) ||
        "";
      const amtStr = formData.get("amount") || formData.get("quantity");
      if (amtStr) amount = parseInt(amtStr.toString(), 10) || 1;
      coupon = (formData.get("coupon") as string) || "";
      explicitApiKey = (formData.get("api_key") as string) || (formData.get("apiKey") as string) || undefined;
    } catch (e) {
      // Fallback
    }
  } else if (contentType.includes("application/json")) {
    try {
      const json = await request.json();
      action = json.action || "";
      productId = json.id || json.product_id || json.productId || "";
      if (json.amount || json.quantity) amount = parseInt(json.amount || json.quantity, 10) || 1;
      coupon = json.coupon || "";
      explicitApiKey = json.api_key || json.apiKey || undefined;
    } catch (e) {
      // Fallback
    }
  }

  // Also check query parameters as fallback
  const url = new URL(request.url);
  if (!productId) {
    productId =
      url.searchParams.get("id") ||
      url.searchParams.get("product_id") ||
      url.searchParams.get("productId") ||
      "";
  }
  if (!action) {
    action = url.searchParams.get("action") || "buyProduct";
  }
  if (!explicitApiKey) {
    explicitApiKey = url.searchParams.get("api_key") || url.searchParams.get("apiKey") || undefined;
  }
  const queryAmt = url.searchParams.get("amount") || url.searchParams.get("quantity");
  if (queryAmt) amount = parseInt(queryAmt, 10) || 1;

  // Authenticate Partner API Key
  const { auth, errorResponse } = await authenticatePartnerApi(request, explicitApiKey);
  if (errorResponse) return errorResponse;
  const { user } = auth!;

  if (!productId) {
    return Response.json(
      {
        status: "error",
        msg: "Thiếu ID sản phẩm cần mua (tham số 'id').",
      },
      { status: 400 }
    );
  }

  if (isNaN(amount) || amount <= 0) {
    amount = 1;
  }

  try {
    const checkoutResult = await checkoutDirect({
      userId: user.id,
      productId: productId.trim(),
      quantity: amount,
    });

    const credentialsList = checkoutResult.credentials.map((c) => c.raw);

    return Response.json({
      status: "success",
      msg: "Mua hàng thành công!",
      trans_id: checkoutResult.orderCode,
      order_code: checkoutResult.orderCode,
      product_id: productId,
      amount: amount,
      total_price: Number(checkoutResult.totalAmount),
      data: credentialsList,
    });
  } catch (err: any) {
    const errorMsg = err?.message || "Giao dịch không thành công";
    return Response.json(
      {
        status: "error",
        msg: errorMsg,
      },
      { status: 400 }
    );
  }
}
