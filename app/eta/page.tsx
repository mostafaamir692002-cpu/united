import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { EtaView } from "@/components/accounting/EtaView";

export default async function EtaPage() {
  const gate = await requirePagePermission(["accounting.eta.view"]);
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <EtaView />
    </main>
  );
}
