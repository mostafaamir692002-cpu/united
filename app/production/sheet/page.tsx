import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { PickingSheet } from "@/components/production/PickingSheet";

export default async function PickingSheetPage() {
  const gate = await requirePagePermission("orders.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <PickingSheet />
    </main>
  );
}