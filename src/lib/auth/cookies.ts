import { cookies } from "next/headers";
import { isProduction } from "@/lib/env";

export const SESSION_COOKIE = "session";
export const CSRF_COOKIE = "csrf";

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function baseOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...baseOptions(), maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...baseOptions(), maxAge: 0 });
}

/**
 * The CSRF token is readable by JavaScript on purpose: the browser client echoes
 * it in the X-CSRF-Token header. It is only meaningful together with the
 * httpOnly session cookie, so exposing it does not weaken the session.
 */
export async function setCsrfCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CSRF_COOKIE, token, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearCsrfCookie(): Promise<void> {
  const store = await cookies();
  store.set(CSRF_COOKIE, "", { ...baseOptions(), httpOnly: false, maxAge: 0 });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function readCsrfCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value;
}