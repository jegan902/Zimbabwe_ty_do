import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminTwoFactorRequired } from "@/lib/auth/two-factor";
import { isAdmin } from "@/lib/types/auth";
import { AdminShell } from "./admin-shell";

/**
 * Authoritative gate for the whole admin portal.
 *
 * The proxy only drops requests without a session cookie; a logged-in customer
 * still reached the page shell and every admin bundle was streamed to them while
 * the client-side check ran. The role is now verified on the server before any
 * admin route renders.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  // Hide the portal from authenticated non-admins instead of telling them it exists.
  if (!isAdmin(user)) {
    notFound();
  }

  return (
    <AdminShell
      user={{ fullName: user.fullName, email: user.email, role: user.role }}
      twoFactorEnabled={Boolean(user.twoFactorEnabled)}
      twoFactorRequired={isAdminTwoFactorRequired()}
    >
      {children}
    </AdminShell>
  );
}
