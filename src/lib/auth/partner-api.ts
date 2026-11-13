import { NextRequest } from "next/server";
import { prisma } from "@/lib/utils/db";

export interface PartnerApiAuth {
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
    status: string;
    apiKey: string | null;
    ipWhitelist: string | null;
  };
  wallet: {
    availableBalance: number;
    balance: number;
    currency: string;
  } | null;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Validates API Key from query params, body, or headers and checks IP Whitelist.
 */
export async function authenticatePartnerApi(
  request: NextRequest,
  explicitApiKey?: string
): Promise<{ auth?: PartnerApiAuth; errorResponse?: Response }> {
  const url = new URL(request.url);
  const apiKey =
    explicitApiKey ||
    url.searchParams.get("api_key") ||
    url.searchParams.get("apiKey") ||
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    undefined;

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return {
      errorResponse: Response.json(
        {
          status: "error",
          msg: "Thiếu api_key hoặc api_key không hợp lệ. Vui lòng cung cấp tham số api_key.",
        },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      apiKey: apiKey.trim(),
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      apiKey: true,
      ipWhitelist: true,
      wallet: {
        select: {
          balance: true,
          reservedBalance: true,
          currency: true,
        },
      },
    },
  });

  if (!user) {
    return {
      errorResponse: Response.json(
        {
          status: "error",
          msg: "API Key không chính xác hoặc tài khoản đã bị khóa/ngưng hoạt động.",
        },
        { status: 401 }
      ),
    };
  }

  // IP Whitelist Check
  const clientIp = getClientIp(request);
  if (user.ipWhitelist && user.ipWhitelist.trim().length > 0) {
    const allowedIps = user.ipWhitelist
      .split(/[\r\n,]+/)
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    const isLocal =
      clientIp === "127.0.0.1" ||
      clientIp === "::1" ||
      clientIp === "localhost";

    if (allowedIps.length > 0 && !allowedIps.includes(clientIp) && !isLocal) {
      return {
        errorResponse: Response.json(
          {
            status: "error",
            msg: `Địa chỉ IP [${clientIp}] không nằm trong danh sách IP Whitelist được cấp phép.`,
            client_ip: clientIp,
          },
          { status: 403 }
        ),
      };
    }
  }

  const available = user.wallet
    ? Math.max(0, Number(user.wallet.balance) - Number(user.wallet.reservedBalance))
    : 0;

  return {
    auth: {
      user: {
        id: user.id,
        email: user.email,
        username: user.email,
        fullName: user.fullName,
        status: user.status,
        apiKey: user.apiKey,
        ipWhitelist: user.ipWhitelist,
      },
      wallet: user.wallet
        ? {
            availableBalance: available,
            balance: Number(user.wallet.balance),
            currency: user.wallet.currency,
          }
        : null,
    },
  };
}
