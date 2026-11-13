import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import crypto from "crypto";

export const POST = apiRoute(async (request: NextRequest) => {
  const sessionUser = await requireApiUser(request);

  const newApiKey = crypto.randomBytes(32).toString("hex");

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: { apiKey: newApiKey },
    select: {
      apiKey: true,
      ipWhitelist: true,
    },
  });

  return successResponse({
    message: "Tạo lại API Key mới thành công",
    apiKey: updated.apiKey,
  });
});
