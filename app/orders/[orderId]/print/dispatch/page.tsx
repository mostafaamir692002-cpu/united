import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { getOrder } from "@/lib/orders-service";
import { getBaseUrl } from "@/lib/absoluteUrl";
import { orderQrSvg } from "@/lib/orderQr";
import { PrintBar } from "@/components/print/PrintBar";
import { PrintHeader } from "@/components/print/PrintHeader";
import { qty } from "@/lib/format";

/** What a loader needs: how much to load per item, and the manifest (driver /
 * vehicle / crates) — filled in already if the order has actually been
 * dispatched, otherwise left blank to write on paper during loading. Never
 * prints a driver/vehicle/crate value that isn't really on the order. */
export default async function DispatchSheetPage({ params }: { params: { orderId: string } }) {
  const gate = await requirePagePermission("orders.load");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  const order = await getOrder(params.orderId).catch(() => null);
  if (!order) notFound();

  const qrSvg = await orderQrSvg(`${getBaseUrl()}/orders/${order.id}`);
  const isDispatched = order.status === "dispatched";

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/orders/${order.id}`} />
      <div className="print-sheet max-w-3xl mx-auto p-6 text-united-dark">
        <PrintHeader
          titleAr="شيت التحميل / التسليم"
          titleEn="Loading / Dispatch Sheet"
          orderNumber={order.orderNumber}
          customerName={order.customerName}
          deliveryDate={order.deliveryDate}
          deliveryTime={order.deliveryTime}
          qrSvg={qrSvg}
        />

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-united-dark text-white">
              <th className="p-2 text-right">#</th>
              <th className="p-2 text-right">الصنف</th>
              <th className="p-2 text-center">الوحدة</th>
              <th className="p-2 text-center">اتجهز (المفروض يتحمل)</th>
              <th className="p-2 text-center">اللي اتحمل فعلاً</th>
              <th className="p-2 text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-united-border print-break-inside-avoid">
                <td className="p-2 text-right text-united-dark/50">{idx + 1}</td>
                <td className="p-2 text-right font-bold text-base">{item.productName}</td>
                <td className="p-2 text-center">{item.unit}</td>
                <td dir="ltr" className="p-2 text-center font-extrabold text-base">
                  {qty(item.preparedQuantity ?? item.requiredQuantity)}
                </td>
                <td className="p-2 text-center">
                  {item.loadedQuantity != null ? (
                    <span dir="ltr" className="font-bold">{qty(item.loadedQuantity)}</span>
                  ) : (
                    <div className="border-b border-united-dark/50 h-8 w-24 mx-auto" />
                  )}
                </td>
                <td className="p-2 text-center">
                  <div className="border-2 border-united-dark/40 rounded w-7 h-7 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-2 border-united-dark/20 rounded-xl p-4 mt-6 text-sm print-break-inside-avoid">
          <div className="font-extrabold mb-2">🚚 بيانات الخروج {isDispatched ? "" : "(هتتملي وقت الخروج)"}</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-united-dark/50 text-xs mb-1">اسم السواق</div>
              {order.driverName ? (
                <div className="font-bold">{order.driverName}</div>
              ) : (
                <div className="border-b border-united-dark/50 h-8" />
              )}
            </div>
            <div>
              <div className="text-united-dark/50 text-xs mb-1">رقم/اسم العربية</div>
              {order.vehicle ? (
                <div className="font-bold">{order.vehicle}</div>
              ) : (
                <div className="border-b border-united-dark/50 h-8" />
              )}
            </div>
            <div>
              <div className="text-united-dark/50 text-xs mb-1">عدد البرنيكة</div>
              {order.crateCount != null ? (
                <div dir="ltr" className="font-bold">{order.crateCount}</div>
              ) : (
                <div className="border-b border-united-dark/50 h-8" />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-10 text-sm print-break-inside-avoid">
          <div>
            <div className="border-b border-united-dark h-14" />
            <div className="text-united-dark/60 mt-1">توقيع السواق (استلام البضاعة)</div>
          </div>
          <div>
            <div className="border-b border-united-dark h-14" />
            <div className="text-united-dark/60 mt-1">توقيع المشرف / وقت الخروج</div>
          </div>
        </div>

        <p className="text-[10px] text-united-dark/30 mt-8">
          اتطبعت {new Date().toLocaleString("ar-EG")} — Order ID: {order.id}
        </p>
      </div>
    </main>
  );
}
