import { NextResponse } from 'next/server';
import { ApiResponse } from '../types';

export function successResponse<T>(data: T, message?: string) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return NextResponse.json(response, { status: 200 });
}

export function createdResponse<T>(data: T, message?: string) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return NextResponse.json(response, { status: 201 });
}

export function errorResponse(
  error: unknown,
  statusCode?: number
) {
  let message = 'An error occurred';
  let code = 'ERROR';
  let details: unknown;

  if (error instanceof Error) {
    message = error.message;
    if ('code' in error) {
      code = (error as { code: string }).code;
    }
    if ('details' in error) {
      details = (error as { details: unknown }).details;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  const status = statusCode || 500;

  const response: ApiResponse = {
    success: false,
    error: code,
    message,
    ...(details !== undefined && { details }),
  };

  return NextResponse.json(response, { status });
}

export function paginatedResponse<T>(items: T[], total: number, page: number, limit: number) {
  return successResponse({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
