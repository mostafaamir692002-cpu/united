import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { StockDashboard } from "@/components/stock/StockDashboard";

export default async function StockPage() {
  const gate = await requirePagePermission("stock.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <StockDashboard />
    </main>
  );
}
