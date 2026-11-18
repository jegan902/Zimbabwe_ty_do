import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getTwoFactorState } from "@/lib/auth/two-factor";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

/**
 * State of the second factor for the signed-in account.
 * `required` is what the UI uses to decide whether to nag the admin.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const user = await requireApiUser(request);
  const state = await getTwoFactorState(user.id);
  return successResponse(state);
});
