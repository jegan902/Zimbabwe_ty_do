import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import {
  apiKeyColumns,
  generateApiKey,
  hasApiKey,
  revealApiKey,
} from "@/lib/auth/api-key";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

const API_KEY_SELECT = {
  id: true,
  email: true,
  apiKey: true,
  apiKeyHash: true,
  apiKeyEnc: true,
  ipWhitelist: true,
  wallet: {
    select: {
      balance: true,
      reservedBalance: true,
    },
  },
} as const;

export const GET = apiRoute(async (request: NextRequest) => {
  const sessionUser = await requireApiUser(request);

  let user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: API_KEY_SELECT,
  });

  // Generate on first access. Only the hash and the AES-256-GCM copy are stored, so
  // a database dump cannot be replayed against the partner API. A stored key that can
  // no longer be decrypted (changed ENCRYPTION_KEY) is replaced instead of shown empty.
  let apiKey = user ? revealApiKey(user) : null;
  if (user && (!hasApiKey(user) || apiKey === null)) {
    apiKey = generateApiKey();
    user = await prisma.user.update({
      where: { id: user.id },
      data: apiKeyColumns(apiKey),
      select: API_KEY_SELECT,
    });
  }

  const available = user?.wallet
    ? Math.max(
        0,
        Number(user.wallet.balance) - Number(user.wallet.reservedBalance),
      )
    : 0;

  return successResponse({
    apiKey: apiKey ?? "",
    ipWhitelist: user?.ipWhitelist || "",
    username: user?.email,
    balance: available,
  });
});

export const PUT = apiRoute(async (request: NextRequest) => {
  const sessionUser = await requireApiUser(request);
  const body = await request.json();

  const ipWhitelist =
    typeof body.ipWhitelist === "string" ? body.ipWhitelist.trim() : "";

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: { ipWhitelist },
    select: {
      ipWhitelist: true,
    },
  });

  return successResponse({
    message: "Cập nhật danh sách IP Whitelist thành công",
    ipWhitelist: updated.ipWhitelist,
  });
});
