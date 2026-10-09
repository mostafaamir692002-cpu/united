import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { getOrder } from "@/lib/orders-service";
import { getBaseUrl } from "@/lib/absoluteUrl";
import { orderQrSvg } from "@/lib/orderQr";
import { PrintBar } from "@/components/print/PrintBar";
import { PrintHeader } from "@/components/print/PrintHeader";
import { qty } from "@/lib/format";

/** What a preparer actually needs on the warehouse floor — required quantities
 * and blank space to write what was actually picked. No status/audit/dispatch
 * noise, unlike the full delivery sheet. */
export default async function PickingSheetPage({ params }: { params: { orderId: string } }) {
  const gate = await requirePagePermission("orders.prepare");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  const order = await getOrder(params.orderId).catch(() => null);
  if (!order) notFound();

  const qrSvg = await orderQrSvg(`${getBaseUrl()}/orders/${order.id}`);

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/orders/${order.id}`} />
      <div className="print-sheet max-w-3xl mx-auto p-6 text-united-dark">
        <PrintHeader
          titleAr="شيت التجهيز"
          titleEn="Preparation / Picking Sheet"
          orderNumber={order.orderNumber}
          customerName={order.customerName}
          deliveryDate={order.deliveryDate}
          deliveryTime={order.deliveryTime}
          qrSvg={qrSvg}
        />

        {order.notes && (
          <p className="text-sm bg-united-dark/5 rounded-lg p-3 mb-4 print-break-inside-avoid">
            📝 ملاحظات: {order.notes}
          </p>
        )}

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-united-dark text-white">
              <th className="p-2 text-right">#</th>
              <th className="p-2 text-right">الصنف</th>
              <th className="p-2 text-center">الوحدة</th>
              <th className="p-2 text-center">المطلوب</th>
              <th className="p-2 text-center">اللي اتجهز فعلاً</th>
              <th className="p-2 text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-united-border print-break-inside-avoid">
                <td className="p-2 text-right text-united-dark/50">{idx + 1}</td>
                <td className="p-2 text-right font-bold text-base">{item.productName}</td>
                <td className="p-2 text-center">{item.unit}</td>
                <td dir="ltr" className="p-2 text-center font-extrabold text-base">{qty(item.requiredQuantity)}</td>
                <td className="p-2 text-center">
                  <div className="border-b border-united-dark/50 h-8 w-24 mx-auto" />
                </td>
                <td className="p-2 text-center">
                  <div className="border-2 border-united-dark/40 rounded w-7 h-7 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-6 mt-10 text-sm print-break-inside-avoid">
          <div>
            <div className="border-b border-united-dark h-14" />
            <div className="text-united-dark/60 mt-1">جهّزه: الاسم + التوقيع</div>
          </div>
          <div>
            <div className="border-b border-united-dark h-14" />
            <div className="text-united-dark/60 mt-1">التاريخ / الوقت</div>
          </div>
        </div>

        <p className="text-[10px] text-united-dark/30 mt-8">
          اتطبعت {new Date().toLocaleString("ar-EG")} — Order ID: {order.id}
        </p>
      </div>
    </main>
  );
}
