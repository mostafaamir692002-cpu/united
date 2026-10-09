import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { ProductMasterView } from "@/components/stock/master/ProductMasterView";

export default async function StockSetupPage() {
  // stock.view to read the master and its coverage; mutations are gated separately on
  // stock.manage_products / stock.manage_suppliers, server-side, per endpoint.
  const gate = await requirePagePermission("stock.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <ProductMasterView />
    </main>
  );
}
