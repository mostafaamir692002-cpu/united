import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { CustomersView } from "@/components/sales/CustomersView";

export default async function SalesPage() {
  const gate = await requirePagePermission("sales.customers.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <CustomersView />
    </main>
  );
}
