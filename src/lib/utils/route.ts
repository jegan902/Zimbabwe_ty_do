import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import logger from "./logger";
import { AppError, InternalServerError } from "./errors";
import { errorResponse } from "./response";
import { assertBodySize, bodyLimitForPath } from "./body";
import { Prisma } from "@prisma/client";

type RouteHandler = (
  request: NextRequest,
  context?: unknown,
) => Promise<NextResponse>;

/**
 * Wraps a route handler so every failure returns the same JSON error shape.
 * Unexpected errors are logged server-side and returned as a generic 500 without details.
 * Oversized bodies are rejected before the handler can buffer them.
 */
export function apiRoute(
  handler: (request: NextRequest) => Promise<NextResponse>,
): RouteHandler {
  return async (request: NextRequest) => {
    try {
      assertBodySize(request, bodyLimitForPath(request.nextUrl.pathname));
      return await handler(request);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * Same as `apiRoute` but keeps Next.js's second argument (dynamic route params).
 * Next 16 passes params as a Promise that must be awaited by the handler.
 */
export function apiRouteWithParams<TParams extends Record<string, string>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<TParams> },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<TParams> },
  ) => {
    try {
      assertBodySize(request, bodyLimitForPath(request.nextUrl.pathname));
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    logger.warn({ details }, "Validation error in API route");
    return errorResponse(
      new AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", details),
      422,
    );
  }

  if (error instanceof AppError) {
    return errorResponse(error, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(", ")
        : "giá trị";
      return errorResponse(
        new AppError(409, "DUPLICATE", `Dữ liệu đã tồn tại (${target})`),
        409,
      );
    }
    if (error.code === "P2025") {
      return errorResponse(
        new AppError(404, "NOT_FOUND", "Không tìm thấy dữ liệu"),
        404,
      );
    }
    if (error.code === "P2003") {
      return errorResponse(
        new AppError(409, "CONSTRAINT", "Dữ liệu liên quan không tồn tại"),
        409,
      );
    }
  }

  logger.error({ err: error }, "Unhandled error in API route");
  return errorResponse(new InternalServerError(), 500);
}
