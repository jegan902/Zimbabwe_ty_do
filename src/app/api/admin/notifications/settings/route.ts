import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import {
  MAX_ALERT_RECIPIENTS,
  MAX_LOW_BALANCE_REPEAT_MINUTES,
  MIN_LOW_BALANCE_REPEAT_MINUTES,
  getAlertRecipients,
  getLowBalanceRepeatMinutes,
  isValidEmail,
  setAlertRecipients,
  setLowBalanceRepeatMinutes,
  splitRecipientInput,
} from "@/lib/services/notification.service";
import { ValidationError } from "@/lib/utils/errors";
import { successResponse } from "@/lib/utils/response";
import { apiRoute } from "@/lib/utils/route";

/**
 * Saves how often the same supplier may be reminded while its balance stays low
 * and/or the recipients of the alert emails. Sending an empty recipients list
 * clears the override and falls back to ADMIN_ALERT_EMAIL.
 */
export const PUT = apiRoute(async (request: NextRequest) => {
  await requireApiAdmin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body phải là JSON");
  }

  const payload = (body ?? {}) as {
    repeatMinutes?: number | string;
    recipients?: unknown;
  };
  const hasRepeat =
    payload.repeatMinutes !== undefined && payload.repeatMinutes !== null;
  const hasRecipients = payload.recipients !== undefined;

  if (!hasRepeat && !hasRecipients) {
    throw new ValidationError("Không có thay đổi nào để lưu");
  }

  let repeatMinutes: number | undefined;
  if (hasRepeat) {
    repeatMinutes = Number(payload.repeatMinutes);
    if (!Number.isFinite(repeatMinutes)) {
      throw new ValidationError("Thời gian nhắc lại không hợp lệ");
    }
    if (
      repeatMinutes < MIN_LOW_BALANCE_REPEAT_MINUTES ||
      repeatMinutes > MAX_LOW_BALANCE_REPEAT_MINUTES
    ) {
      throw new ValidationError(
        `Thời gian nhắc lại phải từ ${MIN_LOW_BALANCE_REPEAT_MINUTES} đến ${MAX_LOW_BALANCE_REPEAT_MINUTES} phút`,
      );
    }
  }

  let recipients: string[] | undefined;
  if (hasRecipients) {
    const tokens = splitRecipientInput(payload.recipients);
    const invalid = tokens.filter((email) => !isValidEmail(email));
    if (invalid.length > 0) {
      throw new ValidationError(`Email không hợp lệ: ${invalid.join(", ")}`);
    }
    if (tokens.length > MAX_ALERT_RECIPIENTS) {
      throw new ValidationError(
        `Chỉ được tối đa ${MAX_ALERT_RECIPIENTS} email nhận cảnh báo`,
      );
    }
    recipients = tokens;
  }

  const savedRepeat =
    repeatMinutes !== undefined
      ? await setLowBalanceRepeatMinutes(repeatMinutes)
      : await getLowBalanceRepeatMinutes();
  const savedRecipients =
    recipients !== undefined
      ? await setAlertRecipients(recipients)
      : await getAlertRecipients();

  return successResponse(
    { repeatMinutes: savedRepeat, recipients: savedRecipients },
    "Đã lưu cài đặt cảnh báo số dư",
  );
});
