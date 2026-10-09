import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { ManagementView } from "@/components/management/ManagementView";

export default async function OperationsReportPage() {
  const gate = await requirePagePermission("reports.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <ManagementView kind="operations" />
    </main>
  );
}
