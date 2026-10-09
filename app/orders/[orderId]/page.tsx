import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { Nav } from "@/components/Nav";
import { OrderDetail } from "@/components/order/OrderDetail";

export default async function OrderPage({ params }: { params: { orderId: string } }) {
  const gate = await requirePagePermission("orders.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  return (
    <main className="min-h-screen">
      <Nav />
      <OrderDetail orderId={params.orderId} />
    </main>
  );
}
