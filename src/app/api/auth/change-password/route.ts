import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { verifyPassword, hashPassword } from "@/lib/utils/crypto";
import { ValidationError, AuthenticationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

export const POST = apiRoute(async (request: NextRequest) => {
  const authUser = await requireApiUser(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON hợp lệ");
  }

  const { currentPassword, newPassword } = (body as {
    currentPassword?: string;
    newPassword?: string;
  }) || {};

  if (!currentPassword || !newPassword) {
    throw new ValidationError("Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới");
  }

  if (newPassword.length < 6) {
    throw new ValidationError("Mật khẩu mới phải có tối thiểu 6 ký tự");
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) {
    throw new AuthenticationError("Tài khoản không tồn tại");
  }

  const isMatch = await verifyPassword(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AuthenticationError("Mật khẩu hiện tại không chính xác");
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return successResponse({
    message: "Đổi mật khẩu thành công!",
  });
});
