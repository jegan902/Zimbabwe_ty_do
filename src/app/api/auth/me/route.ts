import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWalletSnapshot } from "@/lib/wallet/wallet.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

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
      role: user.role,
      status: user.status,
    },
    wallet,
  });
});

