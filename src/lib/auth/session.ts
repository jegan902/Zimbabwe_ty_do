import { cache } from "react";
import { prisma } from "@/lib/utils/db";
import {
  generateCsrfToken,
  generateSessionToken,
  hashSessionToken,
} from "./tokens";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clearCsrfCookie,
  clearSessionCookie,
  readSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from "./cookies";
import type { AuthUser, UserRole } from "@/lib/types/auth";

import type { NextRequest } from "next/server";

interface SessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Creates a session row and sets both cookies.
 * The raw token never touches the database; only its HMAC is persisted.
 */
export async function createSession(userId: string, context: SessionContext = {}) {
  const token = generateSessionToken();
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId,
      token: hashSessionToken(token),
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent?.slice(0, 512) ?? null,
    },
  });

  await setSessionCookie(token);
  await setCsrfCookie(csrfToken);

  return { token, csrfToken, expiresAt };
}

/** Revokes the current session in the database and clears the cookies. */
export async function destroySession(): Promise<void> {
  const raw = await readSessionCookie();
  if (raw) {
    await prisma.session
      .updateMany({
        where: { token: hashSessionToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  await clearSessionCookie();
  await clearCsrfCookie();
}

/** Revokes every session of a user, optionally keeping the current one. */
export async function revokeUserSessions(userId: string, keepRawToken?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepRawToken ? { NOT: { token: hashSessionToken(keepRawToken) } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

function toAuthUser(user: {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: string;
  fullName: string | null;
  avatar: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status as AuthUser["status"],
    fullName: user.fullName,
    avatar: user.avatar,
  };
}

/**
 * Resolves the current user from the session cookie.
 *
 * Wrapped in React `cache` so a single render pass (layout + page + actions)
 * resolves the session at most once. Cookies are read through `next/headers`
 * which automatically opts the calling component into dynamic rendering.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const raw = await readSessionCookie();
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashSessionToken(raw) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          fullName: true,
          avatar: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  // Sliding expiry, refreshed at most once per hour to avoid a write per request.
  if (Date.now() - session.lastUsedAt.getTime() > 60 * 60 * 1000) {
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
    void prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(), expiresAt },
      })
      .catch(() => undefined);
  }

  return toAuthUser(session.user);
});

/** Resolves the session for a Route Handler, where React cache is not available. */
export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const raw =
    request.cookies.get(SESSION_COOKIE)?.value ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashSessionToken(raw) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          fullName: true,
          avatar: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return toAuthUser(session.user);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
    },
  });
  return result.count;
}