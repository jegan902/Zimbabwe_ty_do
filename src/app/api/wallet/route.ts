import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getWalletSnapshot } from "@/lib/wallet/wallet.service";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const GET = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  const snapshot = await getWalletSnapshot(user.id);
  return successResponse(snapshot);
});

