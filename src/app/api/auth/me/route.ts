import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWalletSnapshot } from "@/lib/wallet/wallet.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { prisma } from "@/lib/utils/db";

export const GET = apiRoute(async (request: NextRequest) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return successResponse({ user: null, wallet: null });
  }

  const wallet = await getWalletSnapshot(user.id);

  return successResponse({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: (user as any).phone,
      role: user.role,
      status: user.status,
    },
    wallet,
  });
});

export const PUT = apiRoute(async (request: NextRequest) => {
  const authUser = await getUserFromRequest(request);
  if (!authUser) {
    return successResponse({ user: null });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { fullName, phone } = (body as { fullName?: string; phone?: string }) || {};

  const updated = await prisma.user.update({
    where: { id: authUser.id },
    data: {
      fullName: fullName !== undefined ? fullName.trim() || null : undefined,
      phone: phone !== undefined ? phone.trim() || null : undefined,
    },
  });

  const wallet = await getWalletSnapshot(updated.id);

  return successResponse({
    user: {
      id: updated.id,
      email: updated.email,
      username: updated.username,
      fullName: updated.fullName,
      phone: updated.phone,
      role: updated.role,
      status: updated.status,
    },
    wallet,
  });
});


