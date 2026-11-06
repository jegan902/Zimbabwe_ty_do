import type { NextRequest } from 'next/server';
import { ValidationError } from './errors';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string | null;
}

/**
 * Client IP comes from X-Forwarded-For only when TRUST_PROXY=true, i.e. when a reverse proxy
 * overwrites that header. Otherwise a client could spoof its IP to bypass rate limits.
 */
export function getRequestMeta(request: NextRequest): RequestMeta {
  let ipAddress = 'unknown';
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) ipAddress = forwarded.split(',')[0].trim();
  }
  return {
    ipAddress,
    userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
  };
}

export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
}
