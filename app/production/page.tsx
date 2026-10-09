import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { ProductionBoard } from "@/components/production/ProductionBoard";

export default async function ProductionPage() {
  const gate = await requirePagePermission("orders.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <ProductionBoard />
    </main>
  );
}
