export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";
export type UserStatus = "ACTIVE" | "LOCKED" | "SUSPENDED" | "DELETED";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  fullName: string | null;
  avatar: string | null;
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "ADMIN" || user?.role === "SUPERADMIN";
}

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "SUPERADMIN";
}