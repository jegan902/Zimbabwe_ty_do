/**
 * Environment access.
 *
 * Values are read lazily so that importing a module never throws during a build
 * where secrets are intentionally absent. Anything security-critical fails closed
 * at the moment it is used instead of silently falling back to a weak default.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return read(name);
}

export function requireEnv(name: string, minLength = 1): string {
  const value = read(name);
  if (!value || value.length < minLength) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function envNumber(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envBool(name: string, fallback: boolean): boolean {
  const raw = read(name);
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export const isProduction = () => process.env.NODE_ENV === "production";
export const isDevelopment = () => process.env.NODE_ENV !== "production";

/** Absolute base URL used for payment callbacks and links inside emails. */
export function appBaseUrl(): string {
  return read("NEXT_PUBLIC_APP_URL")?.replace(/\/+$/, "") ?? "http://localhost:3000";
}

export function adminAlertEmails(): string[] {
  return (read("ADMIN_ALERT_EMAIL") ?? "")
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter(Boolean);
}