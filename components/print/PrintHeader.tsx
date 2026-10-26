import Image from "next/image";

export function PrintHeader({
  titleAr,
  titleEn,
  orderNumber,
  customerName,
  externalId,
  deliveryDate,
  deliveryTime,
  qrSvg,
}: {
  titleAr: string;
  titleEn: string;
  orderNumber: string;
  customerName: string;
  externalId?: string | null;
  deliveryDate: string;
  deliveryTime?: string | null;
  qrSvg: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-united-dark pb-4 mb-4 print-break-inside-avoid">
      <div className="flex items-start gap-3">
        <Image src="/logo-united.png" alt="UNITED" width={48} height={48} className="rounded" />
        <div>
          <div className="font-extrabold text-lg text-united-dark leading-tight">UNITED</div>
          <div className="text-[10px] text-united-dark/50">Fruits &amp; Vegetables</div>
          <div className="mt-1.5 font-extrabold text-base text-united-dark">{titleAr}</div>
          <div className="text-[10px] text-united-dark/50">{titleEn}</div>
        </div>
      </div>

      <div className="text-center shrink-0" dir="ltr">
        <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="text-[9px] text-united-dark/50 mt-1">{orderNumber}</div>
      </div>

      <div className="text-xs text-united-dark min-w-[180px] space-y-0.5" dir="rtl">
        <div className="flex justify-between gap-3">
          <span className="text-united-dark/50">رقم الأوردر</span>
          <span className="font-extrabold">{orderNumber}</span>
        </div>
        {externalId && (
          <div className="flex justify-between gap-3">
            <span className="text-united-dark/50">PO</span>
            <span className="font-bold">{externalId}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-united-dark/50">العميل</span>
          <span className="font-bold">{customerName}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-united-dark/50">التسليم</span>
          <span className="font-bold" dir="ltr">
            {deliveryDate} {deliveryTime ?? ""}
          </span>
        </div>
      </div>
    </div>
  );
}
