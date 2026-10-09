import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { PrepBoard } from "@/components/prep/PrepBoard";

export default async function PrepPage() {
  const gate = await requirePagePermission("orders.prepare");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <PrepBoard />
    </main>
  );
}
