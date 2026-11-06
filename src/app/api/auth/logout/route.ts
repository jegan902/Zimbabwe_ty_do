import { NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const POST = apiRoute(async () => {
  await destroySession();
  return successResponse({ message: "Đăng xuất thành công" });
});

