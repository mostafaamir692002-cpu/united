import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { PurchasingView } from "@/components/purchasing/PurchasingView";

export default async function PurchasingPage() {
  const gate = await requirePagePermission(["purchasing.orders.view"]);
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <PurchasingView />
    </main>
  );
}
