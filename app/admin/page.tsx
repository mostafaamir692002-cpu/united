import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const gate = await requirePagePermission("users.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <AdminDashboard />
    </main>
  );
}
