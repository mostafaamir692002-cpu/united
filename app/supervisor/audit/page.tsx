import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { AuditLogView } from "@/components/supervisor/AuditLogView";

export default async function AuditPage() {
  const gate = await requirePagePermission("audit.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <AuditLogView />
    </main>
  );
}
