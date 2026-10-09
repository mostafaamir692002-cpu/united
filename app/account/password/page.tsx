import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authz";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

/** Reachable by every signed-in user — and the only page reachable by one whose
 * password was set by an administrator and is still pending a change. */
export default async function PasswordPage() {
  const user = await getAuthContext();
  if (!user) redirect("/login");
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <ChangePasswordForm forced={user.mustChangePassword} name={user.name} />
    </main>
  );
}
