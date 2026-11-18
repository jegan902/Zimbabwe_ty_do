import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/utils/db";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";
import { adminAlertEmails } from "@/lib/env";
import {
  DEFAULT_LOW_BALANCE_REPEAT_MINUTES,
  MAX_LOW_BALANCE_REPEAT_MINUTES,
  MIN_LOW_BALANCE_REPEAT_MINUTES,
  getLowBalanceRepeatMinutes,
  getAlertRecipients,
  smtpConfigured,
} from "@/lib/services/notification.service";

/**
 * Alert-delivery status for the admin UI: whether email can actually go out, who
 * receives it, and the last notifications written to the outbox.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  const [recent, grouped, repeatMinutes, recipients] = await Promise.all([
    prisma.emailNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        supplierId: true,
        notificationType: true,
        subject: true,
        recipient: true,
        status: true,
        attempts: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.emailNotification.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    getLowBalanceRepeatMinutes(),
    getAlertRecipients(),
  ]);

  return successResponse({
    smtpConfigured: smtpConfigured(),
    recipients,
    envRecipients: adminAlertEmails(),
    settings: {
      repeatMinutes,
      defaultRepeatMinutes: DEFAULT_LOW_BALANCE_REPEAT_MINUTES,
      minRepeatMinutes: MIN_LOW_BALANCE_REPEAT_MINUTES,
      maxRepeatMinutes: MAX_LOW_BALANCE_REPEAT_MINUTES,
    },
    statusCounts: Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ),
    recent: recent.map((row) => ({
      ...row,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});
