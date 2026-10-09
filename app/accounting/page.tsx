import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { AccountingView } from "@/components/accounting/AccountingView";

export default async function AccountingPage() {
  const gate = await requirePagePermission(["accounting.view"]);
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <AccountingView />
    </main>
  );
}
