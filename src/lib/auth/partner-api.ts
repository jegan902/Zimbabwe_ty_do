import { NextRequest } from "next/server";
import { prisma } from "@/lib/utils/db";
import { getClientIp } from "@/lib/utils/request";
import { AppError } from "@/lib/utils/errors";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { resolveApiKeyOwner } from "@/lib/auth/api-key";
import logger from "@/lib/utils/logger";

export interface PartnerApiAuth {
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
    status: string;
    ipWhitelist: string | null;
  };
  wallet: {
    availableBalance: number;
    balance: number;
    currency: string;
  } | null;
}

function rateLimitedResponse(error: AppError): Response {
  const retryAfter = (
    error.details as { retryAfterSeconds?: number } | undefined
  )?.retryAfterSeconds;
  return Response.json(
    {
      status: "error",
      msg: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    },
    {
      status: 429,
      ...(retryAfter ? { headers: { "Retry-After": String(retryAfter) } } : {}),
    },
  );
}

async function enforceRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | undefined> {
  try {
    await consumeRateLimit(scope, identifier, limit, windowSeconds);
    return undefined;
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 429)
      return rateLimitedResponse(error);
    throw error;
  }
}

/**
 * Validates API Key from headers, body, or query params and checks IP Whitelist.
 *
 * Keys travel hashed-only through the database, so the presented value is hashed
 * before lookup. Query-string keys still work for existing partner scripts but are
 * discouraged because URLs end up in access logs and `Referer` headers.
 */
export async function authenticatePartnerApi(
  request: NextRequest,
  explicitApiKey?: string,
): Promise<{ auth?: PartnerApiAuth; errorResponse?: Response }> {
  const url = new URL(request.url);
  const headerKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    undefined;
  const queryKey =
    url.searchParams.get("api_key") ||
    url.searchParams.get("apiKey") ||
    undefined;

  // Header first, then body/form value, then the deprecated query string.
  const apiKey = headerKey || explicitApiKey || queryKey;
  const usedQueryString = !headerKey && !explicitApiKey && Boolean(queryKey);

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return {
      errorResponse: Response.json(
        {
          status: "error",
          msg: "Thiếu api_key hoặc api_key không hợp lệ. Vui lòng gửi key qua header X-API-Key.",
        },
        { status: 401 },
      ),
    };
  }

  if (usedQueryString) {
    logger.warn(
      { path: url.pathname },
      "Partner called the API with ?api_key= in the URL; prefer the X-API-Key header",
    );
  }

  const clientIp = getClientIp(request);

  // Unauthenticated guess quota per IP. The key is only usable when a trusted proxy (or an
  // edge header) resolved a real address; otherwise every caller shares "unknown" and the
  // per-user quota below is the only fair signal.
  if (clientIp !== "unknown") {
    const limited = await enforceRateLimit(
      "partner-api-auth",
      clientIp,
      30,
      60,
    );
    if (limited) return { errorResponse: limited };
  }

  const owner = await resolveApiKeyOwner(apiKey);
  if (!owner) {
    return {
      errorResponse: Response.json(
        {
          status: "error",
          msg: "API Key không chính xác hoặc tài khoản đã bị khóa/ngưng hoạt động.",
        },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: owner.id, status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
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
        { status: 401 },
      ),
    };
  }

  // IP Whitelist Check
  if (user.ipWhitelist && user.ipWhitelist.trim().length > 0) {
    const allowedIps = user.ipWhitelist
      .split(/[\r\n,]+/)
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    const isLocal =
      clientIp === "127.0.0.1" ||
      clientIp === "::1" ||
      clientIp === "localhost";

    if (clientIp === "unknown") {
      // No trustworthy client address (no proxy headers): the whitelist cannot be
      // evaluated, so the API key remains the only gate. Warn once per request so the
      // deployment can set TRUST_PROXY instead of silently believing the check ran.
      logger.warn(
        { userId: user.id },
        "Partner IP whitelist skipped: client IP could not be resolved",
      );
    } else if (
      allowedIps.length > 0 &&
      !allowedIps.includes(clientIp) &&
      !isLocal
    ) {
      return {
        errorResponse: Response.json(
          {
            status: "error",
            msg: `Địa chỉ IP [${clientIp}] không nằm trong danh sách IP Whitelist được cấp phép.`,
            client_ip: clientIp,
          },
          { status: 403 },
        ),
      };
    }
  }

  // Authenticated quota, keyed by user: one partner must not be able to exhaust the
  // supplier capacity (or the wallet) with concurrent purchase loops.
  const quotaExceeded = await enforceRateLimit("partner-api", user.id, 60, 60);
  if (quotaExceeded) return { errorResponse: quotaExceeded };

  const available = user.wallet
    ? Math.max(
        0,
        Number(user.wallet.balance) - Number(user.wallet.reservedBalance),
      )
    : 0;

  return {
    auth: {
      user: {
        id: user.id,
        email: user.email,
        username: user.email,
        fullName: user.fullName,
        status: user.status,
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
