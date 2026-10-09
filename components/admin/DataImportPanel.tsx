"use client";

import { useMemo, useState } from "react";
import { apiPostForm } from "@/lib/api-client";
import { isValidISODate } from "@/lib/dates";

type Kind = "customers" | "suppliers" | "products" | "product_settings" | "product_packaging" | "opening_stock" | "opening_balances" | "sales_prices" | "supplier_prices";
type Preview = { rows: { rowNumber: number; label: string; errors: string[] }[]; rowCount: number; errorCount: number };
type Commit = { created: number; failed: number; results: { rowNumber: number | null; status: string; code?: string; document?: string; error?: string }[] };

function localISODate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const labels: Record<Kind, string> = {
  customers: "كروت العملاء",
  suppliers: "كروت الموردين",
  products: "كروت الأصناف",
  product_settings: "إعدادات الأصناف",
  product_packaging: "وحدات تعبئة الأصناف",
  opening_stock: "رصيد المخزون الافتتاحي",
  opening_balances: "أرصدة العملاء والموردين",
  sales_prices: "أسعار البيع للعملاء",
  supplier_prices: "أسعار الشراء للموردين",
};

export function DataImportPanel({ allowed }: { allowed: Partial<Record<Kind, boolean>> }) {
  const kinds = useMemo(() => (Object.keys(labels) as Kind[]).filter((kind) => allowed[kind]), [allowed]);
  const [kind, setKind] = useState<Kind>(kinds[0] ?? "customers");
  const [file, setFile] = useState<File | null>(null);
  const [businessDate, setBusinessDate] = useState(localISODate);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Commit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function chooseFile(next: File | null) {
    setFile(next); setPreview(null); setResult(null); setError(null);
    if (!next) return;
    if (!/\.(csv|xlsx)$/i.test(next.name)) { setFile(null); setError("اختار ملف CSV أو Excel بصيغة XLSX"); return; }
    if (next.size > 2_000_000) { setFile(null); setError("حجم الملف أكبر من 2 ميجابايت"); return; }
  }

  async function submit(action: "preview" | "commit") {
    setBusy(true); setError(null); setResult(null);
    try {
      if (!file) throw new Error("اختار ملف الاستيراد");
      const form = new FormData();
      form.append("action", action);
      form.append("kind", kind);
      form.append("file", file);
      if (kind === "opening_stock") form.append("business_date", businessDate);
      const response = await apiPostForm<Preview | Commit>("/api/admin/data-import", form);
      if (action === "preview") setPreview(response as Preview);
      else { setResult(response as Commit); setPreview(null); }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تنفيذ الاستيراد"); }
    finally { setBusy(false); }
  }

  if (!kinds.length) return <section className="card p-4">مفيش صلاحية متاحة لاستيراد البيانات.</section>;
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-united-dark">تجهيز بيانات التشغيل</h2>
          <p className="text-sm font-bold text-united-muted mt-1">تقدر تدخل الكروت يدويًا من المبيعات والمشتريات والمخزون، أو ترفع CSV / Excel XLSX (أول ورقة عمل). المعاينة لا تحفظ أي بيانات.</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold text-united-muted">نوع البيانات</span>
          <select className="input" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setFile(null); setPreview(null); setResult(null); setError(null); }}>
            {kinds.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <a className="btn-secondary" href={`/api/admin/data-import?template=${kind}`}>تنزيل قالب CSV</a>
          <label className="btn-secondary cursor-pointer">اختيار ملف CSV / Excel<input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} /></label>
          <span className="text-xs font-bold text-united-muted">{file?.name ?? "مفيش ملف مختار"}</span>
        </div>
        {kind === "opening_stock" && <label className="flex flex-col gap-1 max-w-xs"><span className="text-xs font-extrabold text-united-muted">تاريخ الرصيد الافتتاحي</span><input className="input" type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} /></label>}
        {kind === "opening_stock" && <p className="text-xs font-bold text-united-muted">ملف الأرصدة يستخدم SKU الصنف، والكمية ووحدتها وتكلفة الوحدة. كل الملف يسجل في مستند واحد ذري؛ إعادة الملف نفسه لا تكرر الرصيد.</p>}
        {file?.name.toLowerCase().endsWith(".xlsx") && <p className="text-xs font-bold text-united-muted">يُقرأ أول Sheet فقط؛ استخدم قيمًا ثابتة بدل المعادلات، واجعل الأكواد والأرقام التعريفية (مثل SKU والرقم الضريبي) نصًا للحفاظ على الأصفار في بدايتها.</p>}
        {kind === "opening_balances" && <p className="text-xs font-bold text-united-muted">استخدم كود العميل أو المورد الظاهر في المتحدة، وأدخل الرصيد الافتتاحي مرة واحدة بعد اعتماد تاريخ القطع.</p>}
        {kind === "sales_prices" && <p className="text-xs font-bold text-united-muted">استخدم كود قائمة الأسعار وSKU الصنف. لازم تكون قائمة الأسعار موجودة ومربوطة بالعميل من قبل.</p>}
        {kind === "supplier_prices" && <p className="text-xs font-bold text-united-muted">استخدم كود المورد وSKU الصنف. الأسعار بتاريخ صلاحية وبالجنيه المصري.</p>}
        {kind === "products" && <p className="text-xs font-bold text-united-muted">قالب الأصناف يقبل الاسم وSKU والوحدة ومتابعة المخزون. عمود sales_tax_code اختياري ويتطلب صلاحية إدارة الضرائب؛ اتركه فارغًا فقط للأصناف المعفاة المعتمدة.</p>}
        {kind === "product_settings" && <p className="text-xs font-bold text-united-muted">يحدّث الملف إعدادات SKU موجود: الصلاحية، FEFO/FIFO، التبريد، حدود المخزون، وطريقة التكلفة. طريقة التكلفة والتكلفة المعيارية تحتاج صلاحية الحسابات.</p>}
        {kind === "product_packaging" && <p className="text-xs font-bold text-united-muted">كل صف يعرّف تعبئة لصنف: SKU + وحدة التعبئة + عدد وحدات الأساس داخلها. معاملات التعبئة مرتبطة بالصنف نفسه وليست عامة.</p>}
        {kind === "customers" && <p className="text-xs font-bold text-united-muted">يمكن تحميل مدة السداد وحد الائتمان والإيقاف الآجل وقائمة الأسعار مع كارت العميل. الحقول المالية وربط القائمة تتطلب صلاحيات المالية والتسعير وسببًا مسجلًا.</p>}
        {error && <p role="alert" className="rounded-xl bg-united-danger/10 p-3 text-sm font-bold text-united-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy || !file || (kind === "opening_stock" && !isValidISODate(businessDate))} onClick={() => submit("preview")}>{busy ? "جارٍ الفحص…" : "معاينة وفحص"}</button>
          <button type="button" className="btn-secondary" disabled={busy || !file || !preview || preview.errorCount > 0} onClick={() => submit("commit")}>{busy ? "جارٍ الحفظ…" : "حفظ الصفوف"}</button>
        </div>
      </section>

      {preview && <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-extrabold text-united-dark">نتيجة الفحص: {preview.rowCount} صف · {preview.errorCount} محتاج تصحيح</h3>
        {preview.errorCount === 0 ? <p className="text-sm font-bold text-united-green">الملف اجتاز فحص التنسيق والحقول. الحفظ هيظل خاضعًا لقواعد الكروت والقيود الفريدة.</p> : null}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-right"><th className="p-2">الصف</th><th className="p-2">البيان</th><th className="p-2">الحالة</th></tr></thead><tbody>
          {preview.rows.slice(0, 50).map((row) => <tr className="border-t border-united-border" key={row.rowNumber}><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.label}</td><td className={`p-2 font-bold ${row.errors.length ? "text-united-danger" : "text-united-green"}`}>{row.errors.length ? row.errors.join(" · ") : "جاهز"}</td></tr>)}
        </tbody></table></div>
        {preview.rows.length > 50 && <p className="text-xs font-bold text-united-muted">معروض أول 50 صف؛ فحص الملف شمل كل الصفوف.</p>}
      </section>}

      {result && <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-extrabold text-united-dark">تم حفظ {result.created} · تعذر حفظ {result.failed}</h3>
        <p className="text-xs font-bold text-united-muted">لو حصل فشل جزئي، الصفوف الناجحة محفوظة. صحح الصفوف الفاشلة ثم ارفع الجزء المتبقي فقط.</p>
        <div className="max-h-72 overflow-auto"><ul className="divide-y divide-united-border">{result.results.map((row, i) => <li className="py-2 text-sm" key={`${row.rowNumber}-${i}`}><span className="font-extrabold">{row.rowNumber ? `صف ${row.rowNumber}` : "مستند"}:</span> {row.status}{row.code ? ` · ${row.code}` : ""}{row.document ? ` · ${row.document}` : ""}{row.error ? <span className="text-united-danger"> · {row.error}</span> : null}</li>)}</ul></div>
      </section>}
    </div>
  );
}
