import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { InventoryView } from "@/components/stock/inventory/InventoryView";

export default async function InventoryPage() {
  const gate = await requirePagePermission("stock.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <InventoryView />
    </main>
  );
}
