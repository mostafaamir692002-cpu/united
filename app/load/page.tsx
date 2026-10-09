import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { LoadBoard } from "@/components/load/LoadBoard";

export default async function LoadPage() {
  const gate = await requirePagePermission("orders.load");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <LoadBoard />
    </main>
  );
}
