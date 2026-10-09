import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { IntakeList } from "@/components/stock/IntakeList";

export default async function StockEntriesPage() {
  const gate = await requirePagePermission("stock.receive");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <IntakeList />
    </main>
  );
}
