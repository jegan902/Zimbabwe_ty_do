import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { encryptSecret } from "@/lib/suppliers/http";
import { successResponse } from "@/lib/utils/response";
import { apiRouteWithParams } from "@/lib/utils/route";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";

export const PUT = apiRouteWithParams<{ id: string }>(async (request: NextRequest, { params }) => {
  await requireApiAdmin(request);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const { apiKey, baseUrl, profitValue, status } = (body as {
    apiKey?: string;
    baseUrl?: string;
    profitValue?: number;
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  }) || {};

  const existing = await prisma.supplier.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new NotFoundError("Không tìm thấy nhà cung cấp");
  }

  const updateData: any = {};
  if (apiKey && apiKey.trim()) {
    updateData.apiKey = encryptSecret(apiKey.trim());
  }
  if (baseUrl && baseUrl.trim()) {
    updateData.baseUrl = baseUrl.trim();
  }
  if (profitValue !== undefined && profitValue !== null) {
    updateData.profitValue = profitValue;
  }
  if (status) {
    updateData.status = status;
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: updateData,
  });

  return successResponse({
    id: updated.id,
    name: updated.name,
    baseUrl: updated.baseUrl,
    status: updated.status,
    profitValue: updated.profitValue.toString(),
  });
});
