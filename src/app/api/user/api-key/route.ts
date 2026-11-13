import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import crypto from "crypto";

export const GET = apiRoute(async (request: NextRequest) => {
  const sessionUser = await requireApiUser(request);

  let user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      apiKey: true,
      ipWhitelist: true,
      wallet: {
        select: {
          balance: true,
          reservedBalance: true,
        },
      },
    },
  });

  // Auto-generate apiKey if not exists yet
  if (user && !user.apiKey) {
    const randomHex = crypto.randomBytes(32).toString("hex");
    user = await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: randomHex },
      select: {
        id: true,
        email: true,
        apiKey: true,
        ipWhitelist: true,
        wallet: {
          select: {
            balance: true,
            reservedBalance: true,
          },
        },
      },
    });
  }

  const available = user?.wallet
    ? Math.max(0, Number(user.wallet.balance) - Number(user.wallet.reservedBalance))
    : 0;

  return successResponse({
    apiKey: user?.apiKey || "",
    ipWhitelist: user?.ipWhitelist || "",
    username: user?.email,
    balance: available,
  });
});

export const PUT = apiRoute(async (request: NextRequest) => {
  const sessionUser = await requireApiUser(request);
  const body = await request.json();

  const ipWhitelist = typeof body.ipWhitelist === "string" ? body.ipWhitelist.trim() : "";

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: { ipWhitelist },
    select: {
      apiKey: true,
      ipWhitelist: true,
    },
  });

  return successResponse({
    message: "Cập nhật danh sách IP Whitelist thành công",
    ipWhitelist: updated.ipWhitelist,
  });
});
