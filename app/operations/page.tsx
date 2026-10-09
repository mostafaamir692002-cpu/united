import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { OperationsView } from "@/components/operations/OperationsView";

export default async function OperationsPage() {
  const gate = await requirePagePermission("orders.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <OperationsView />
    </main>
  );
}
