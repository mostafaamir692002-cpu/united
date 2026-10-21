"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { newClientKey } from "@/lib/clientKey";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { todayLocalISO } from "@/lib/localDate";
import { Field, Tabs, fmtMoney } from "@/components/stock/inventory/shared";
import { Pagination } from "@/components/ui/Pagination";

/**
 * Finance: cash position, customer receipts, supplier payments, journals, trial
 * balance, periods and bank reconciliation. Every number here is read from the
 * ledger the documents post to; nothing on this screen is computed twice.
 */

type Tab = "health" | "cash" | "receipts" | "payments" | "journals" | "trial" | "vat" | "periods" | "reconcile" | "opening";
const fail = (toast: ReturnType<typeof useToast>, err: unknown) => toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
const METHOD: Record<string, string> = { cash: "نقدي", bank_transfer: "تحويل بنكي", cheque: "شيك", wallet: "محفظة", other: "أخرى" };
const SOURCE: Record<string, string> = { manual: "يدوي", sales_invoice: "فاتورة مبيعات", credit_note: "إشعار دائن", supplier_bill: "فاتورة مورد", debit_note: "إشعار مدين", customer_receipt: "تحصيل", supplier_payment: "سداد", stock_valuation: "تقييم مخزون", reversal: "عكس قيد", expense: "مصروف", employee_transaction: "حركة موظف", opening_balance: "رصيد افتتاحي", receipt_reversal: "عكس تحصيل", payment_reversal: "عكس سداد", customer_refund: "رد مبلغ لعميل", supplier_refund: "استرداد من مورد" };
const yearStart = () => `${todayLocalISO().slice(0, 4)}-01-01`;

export function AccountingView() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("health");
  const items: { key: Tab; label: string }[] = [
    { key: "health", label: "سلامة الحسابات" },
    { key: "cash", label: "النقدية" },
    { key: "receipts", label: "التحصيل" },
    { key: "payments", label: "السداد" },
    { key: "journals", label: "القيود" },
    { key: "trial", label: "ميزان المراجعة" },
    { key: "vat", label: "ملخص الضريبة" },
    { key: "periods", label: "الفترات" },
    ...(can("accounting.manage") ? [{ key: "reconcile" as Tab, label: "تسوية البنك" }, { key: "opening" as Tab, label: "الأرصدة الافتتاحية" }] : []),
  ];
  return (
    <div className="p-4 max-w-5xl mx-auto pb-10 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-united-dark">الحسابات</h1>
      <Tabs value={tab} onChange={setTab} items={items} />
      {tab === "health" ? <Health /> : tab === "opening" ? <Opening /> : tab === "cash" ? <Cash /> : tab === "receipts" ? <><MoneyIn kind="receipts" /><Refunds kind="customer" /></> : tab === "payments" ? <><MoneyIn kind="payments" /><Refunds kind="supplier" /></> : tab === "journals" ? <Journals /> : tab === "trial" ? <Trial /> : tab === "vat" ? <VatSummary /> : tab === "periods" ? <Periods /> : <Reconcile />}
    </div>
  );
}

function Cash() {
  const q = useQuery({ queryKey: ["acc", "cash"], queryFn: () => apiFetch<{ cash: { rows: { id: string; name: string; type: string; glCode: string; balance: string }[]; total: string } }>("/api/accounting/cash") });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <section className="grid gap-2 sm:grid-cols-3">
      {q.data.cash.rows.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="text-sm font-bold text-united-muted">{r.name} · <span dir="ltr">{r.glCode}</span></div>
          <div className="text-2xl font-extrabold" dir="ltr">{fmtMoney(r.balance)}</div>
        </div>
      ))}
      <div className="card p-4 bg-united-green/10">
        <div className="text-sm font-bold text-united-muted">إجمالي النقدية</div>
        <div className="text-2xl font-extrabold text-united-green" dir="ltr">{fmtMoney(q.data.cash.total)}</div>
      </div>
    </section>
  );
}

/** Receipts from customers or payments to suppliers: the form allocates to open documents (or oldest-first). */
function MoneyIn({ kind }: { kind: "receipts" | "payments" }) {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const isReceipt = kind === "receipts";
  const manage = can(isReceipt ? "accounting.receipts.manage" : "accounting.payments.manage");
  const parties = useQuery({
    queryKey: ["acc", "parties", kind],
    queryFn: () => (isReceipt ? apiFetch<{ customers: { id: string; code: string; name: string }[] }>("/api/sales/customers").then((r) => r.customers) : apiFetch<{ suppliers: { id: string; code: string; name: string }[] }>("/api/purchasing/suppliers").then((r) => r.suppliers)),
    enabled: manage,
  });
  const [party, setParty] = useState("");
  const [form, setForm] = useState({ amount: "", method: "cash", cash_account_id: "cash_main", reference: "", date: todayLocalISO() });
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [key, setKey] = useState(newClientKey);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const open = useQuery({
    queryKey: ["acc", "open", kind, party],
    queryFn: () => apiFetch<{ invoices?: { id: string; number: string; dueDate: string; open: string }[]; bills?: { id: string; number: string; dueDate: string; open: string }[] }>(isReceipt ? `/api/accounting/customers/${party}/open-invoices` : `/api/accounting/suppliers/${party}/open-bills`).then((r) => r.invoices ?? r.bills ?? []),
    enabled: !!party,
  });
  const list = useQuery({
    queryKey: ["acc", kind, page],
    queryFn: async () => {
      const r = await apiFetch<Record<string, any[]> & { pagination: { total: number; limit: number; offset: number } }>(`/api/accounting/${kind}?limit=${pageSize}&offset=${(page - 1) * pageSize}`);
      const items: any[] = r[kind] ?? [];
      const totalPages = Math.max(1, Math.ceil((r.pagination?.total ?? 0) / pageSize));
      return { items, total: r.pagination?.total ?? 0, totalPages };
    },
  });
  const explicit = Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([document_id, amount]) => ({ document_id, amount }));
  return (
    <div className="flex flex-col gap-3">
      {manage && (
        <section className="card p-4 flex flex-col gap-2">
          <h3 className="font-extrabold">{isReceipt ? "تحصيل من عميل" : "سداد لمورد"}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Field label={isReceipt ? "العميل" : "المورد"}>
              <select className="field font-bold" value={party} onChange={(e) => { setParty(e.target.value); setAlloc({}); }}>
                <option value="">— اختار —</option>
                {parties.data?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </Field>
            <Field label="المبلغ"><input className="field" dir="ltr" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="التاريخ"><input type="date" className="field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="الطريقة"><select className="field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="الخزينة / البنك"><select className="field" value={form.cash_account_id} onChange={(e) => setForm({ ...form, cash_account_id: e.target.value })}><option value="cash_main">الخزينة الرئيسية</option><option value="bank_main">الحساب البنكي</option></select></Field>
            <Field label="المرجع (رقم تحويل / شيك)"><input className="field" dir="ltr" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          </div>
          {party && (open.data?.length ? (
            <ul className="text-sm font-bold divide-y divide-united-dark/5">
              {open.data.map((d) => (
                <li key={d.id} className="py-1 flex items-center justify-between gap-2">
                  <span><span dir="ltr">{d.number}</span> · استحقاق {d.dueDate} · مفتوح <span dir="ltr">{fmtMoney(d.open)}</span></span>
                  <input className="field w-28" dir="ltr" inputMode="decimal" placeholder="تخصيص" aria-label={`تخصيص ${d.number}`} value={alloc[d.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [d.id]: e.target.value })} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm font-bold text-united-muted">مفيش مستندات مفتوحة — المبلغ هيتسجل تحت الحساب.</p>)}
          <p className="text-xs font-bold text-united-muted">لو مخصصتش يدوي، المبلغ بيتخصص على الأقدم استحقاقًا؛ الباقي بيفضل تحت الحساب.</p>
          <button type="button" className="btn-primary" disabled={!party || !form.amount || busy} onClick={async () => {
            setBusy(true);
            try {
              const r = await apiPost<Record<string, { number: string }>>(`/api/accounting/${kind}`, { party_id: party, amount: form.amount, method: form.method, cash_account_id: form.cash_account_id, reference: form.reference || null, date: form.date, idempotency_key: key, ...(explicit.length ? { allocations: explicit } : { auto: true }) });
              toast.show(`اتسجل ${(r.receipt ?? r.payment).number}`, "success");
              setForm({ ...form, amount: "", reference: "" });
              setAlloc({});
              setKey(newClientKey());
              void qc.invalidateQueries({ queryKey: ["acc"] });
            } catch (err) { fail(toast, err); } finally { setBusy(false); }
          }}>{isReceipt ? "سجّل التحصيل" : "سجّل السداد"}</button>
        </section>
      )}
      {list.isLoading && <LoadingState />}
      {list.data?.items.length === 0 && <EmptyState icon="💵" title="مفيش حركات" />}
      <ul className="flex flex-col gap-2">
        {list.data?.items.map((r: any) => (
          <li key={r.id} className={`card p-3 flex justify-between gap-2 text-sm font-bold ${r.reversal ? "opacity-70" : ""}`}>
            <div>
              <div className="font-extrabold"><span dir="ltr">{r.number}</span> · {r.customer?.name ?? r.supplier?.name}</div>
              <div className="text-xs text-united-muted">{r.date} · {METHOD[r.method]} · {r.cashAccount}{r.reference ? <> · <span dir="ltr">{r.reference}</span></> : null}{Number(r.unallocated) > 0 ? ` · تحت الحساب ${r.unallocated}` : ""}</div>
              {r.reversal && <div className="text-xs text-united-danger">اتعكس {r.reversal.date} · {r.reversal.reason} · {r.reversal.by}</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span dir="ltr" className={`font-extrabold ${r.reversal ? "line-through" : ""}`}>{fmtMoney(r.amount)}</span>
              {!r.reversal && can("accounting.manage") && (
                <button type="button" className="text-xs text-united-danger underline" onClick={async () => {
                  const reason = window.prompt(isReceipt ? `سبب عكس ${r.number}؟ (مثلاً: شيك مرتجع)` : `سبب عكس ${r.number}؟`);
                  if (!reason?.trim()) return;
                  try { await apiPost(`/api/accounting/${kind}/${r.id}/reverse`, { reason }); toast.show(`${r.number} اتعكس — المستندات اللي كان متخصص عليها اتفتحت تاني`, "success"); void qc.invalidateQueries({ queryKey: ["acc"] }); } catch (err) { fail(toast, err); }
                }}>عكس</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {list.data && <Pagination page={page} pageSize={pageSize} total={list.data.total} onChange={setPage} />}
    </div>
  );
}

/**
 * Credit a party holds, paid out in money: a customer who returned goods after paying,
 * or a supplier paying us back after a debit note. Never more than the credit — the
 * server refuses it — and each filled form is one key, so a double tap pays once.
 */
function Refunds({ kind }: { kind: "customer" | "supplier" }) {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const isCustomer = kind === "customer";
  const manage = can(isCustomer ? "accounting.payments.manage" : "accounting.receipts.manage");
  const path = isCustomer ? "customer-refunds" : "supplier-refunds";
  const parties = useQuery({
    queryKey: ["acc", "parties", isCustomer ? "receipts" : "payments"],
    queryFn: () => (isCustomer ? apiFetch<{ customers: { id: string; code: string; name: string }[] }>("/api/sales/customers?include_inactive=1").then((r) => r.customers) : apiFetch<{ suppliers: { id: string; code: string; name: string }[] }>("/api/purchasing/suppliers?include_inactive=1").then((r) => r.suppliers)),
    enabled: manage,
  });
  const list = useQuery({ queryKey: ["acc", path], queryFn: () => apiFetch<{ refunds: { id: string; number: string; date: string; amount: string; method: string; reason: string; createdBy: string; customer?: { name: string }; supplier?: { name: string }; cashAccount: string }[] }>(`/api/accounting/${path}`).then((r) => r.refunds) });
  const [form, setForm] = useState({ party: "", amount: "", method: "cash", cash_account_id: "cash_main", reference: "", reason: "" });
  const [key, setKey] = useState(newClientKey);
  const [busy, setBusy] = useState(false);
  return (
    <section className="card p-4 flex flex-col gap-2">
      <h3 className="font-extrabold">{isCustomer ? "رد مبلغ لعميل (من رصيده الدائن)" : "استرداد مبلغ من مورد (من رصيدنا عنده)"}</h3>
      {manage && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Field label={isCustomer ? "العميل" : "المورد"}>
              <select className="field font-bold" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })}>
                <option value="">— اختار —</option>
                {parties.data?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </Field>
            <Field label="المبلغ"><input className="field" dir="ltr" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="الطريقة"><select className="field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="الخزينة / البنك"><select className="field" value={form.cash_account_id} onChange={(e) => setForm({ ...form, cash_account_id: e.target.value })}><option value="cash_main">الخزينة الرئيسية</option><option value="bank_main">الحساب البنكي</option></select></Field>
            <Field label="المرجع"><input className="field" dir="ltr" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
            <Field label="السبب"><input className="field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          </div>
          <button type="button" className="btn-secondary" disabled={!form.party || !form.amount || !form.reason.trim() || busy} onClick={async () => {
            setBusy(true);
            try {
              const r = await apiPost<{ refund: { number: string } }>(`/api/accounting/${path}`, { party_id: form.party, amount: form.amount, method: form.method, cash_account_id: form.cash_account_id, reference: form.reference || null, reason: form.reason, idempotency_key: key });
              toast.show(`اتسجل ${r.refund.number}`, "success");
              setForm({ ...form, amount: "", reference: "", reason: "" });
              setKey(newClientKey());
              void qc.invalidateQueries({ queryKey: ["acc"] });
            } catch (err) { fail(toast, err); } finally { setBusy(false); }
          }}>{isCustomer ? "سجّل رد المبلغ" : "سجّل الاسترداد"}</button>
        </>
      )}
      {list.data?.length ? (
        <ul className="text-sm font-bold divide-y divide-united-dark/5">
          {list.data.map((f) => (
            <li key={f.id} className="py-1 flex justify-between gap-2">
              <span><span dir="ltr">{f.number}</span> · {f.customer?.name ?? f.supplier?.name} · {f.date} · {METHOD[f.method]} · {f.reason}</span>
              <span dir="ltr" className="font-extrabold">{fmtMoney(f.amount)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm font-bold text-united-muted">{list.isLoading ? "…" : "مفيش حركات"}</p>}
    </section>
  );
}

type Journal = { id: string; number: string; date: string; description: string; sourceType: string; total: string; reversedBy?: { number: string } | null; lines?: { id: string; debit: string; credit: string; description: string | null; account: { code: string; nameAr: string } }[] };

function Journals() {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [jPage, setJPage] = useState(1);
  const jPageSize = 50;
  const q = useQuery({ queryKey: ["acc", "journals", jPage], queryFn: () => apiFetch<{ journals: Journal[]; pagination: { total: number } }>(`/api/accounting/journals?limit=${jPageSize}&offset=${(jPage - 1) * jPageSize}`) });
  const detail = useQuery({ queryKey: ["acc", "journal", open], queryFn: () => apiFetch<{ journal: Journal }>(`/api/accounting/journals/${open}`), enabled: !!open });
  const accounts = useQuery({ queryKey: ["acc", "accounts"], queryFn: () => apiFetch<{ accounts: { id: string; code: string; nameAr: string; postable: boolean }[] }>("/api/accounting/accounts"), enabled: can("accounting.manage") });
  const [m, setM] = useState({ date: todayLocalISO(), description: "", lines: [{ account_id: "", debit: "", credit: "" }, { account_id: "", debit: "", credit: "" }] });
  const [mKey, setMKey] = useState(newClientKey);
  return (
    <div className="flex flex-col gap-3">
      {can("accounting.manage") && (
        <details className="card p-4">
          <summary className="font-extrabold cursor-pointer">قيد يدوي</summary>
          <div className="flex flex-col gap-2 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
              <input className="field" placeholder="البيان" value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} />
            </div>
            {m.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_6rem] gap-2">
                <select className="field" value={l.account_id} onChange={(e) => setM({ ...m, lines: m.lines.map((x, j) => (j === i ? { ...x, account_id: e.target.value } : x)) })}>
                  <option value="">الحساب</option>
                  {accounts.data?.accounts.filter((a) => a.postable).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.nameAr}</option>)}
                </select>
                <input className="field" dir="ltr" placeholder="مدين" value={l.debit} onChange={(e) => setM({ ...m, lines: m.lines.map((x, j) => (j === i ? { ...x, debit: e.target.value } : x)) })} />
                <input className="field" dir="ltr" placeholder="دائن" value={l.credit} onChange={(e) => setM({ ...m, lines: m.lines.map((x, j) => (j === i ? { ...x, credit: e.target.value } : x)) })} />
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setM({ ...m, lines: [...m.lines, { account_id: "", debit: "", credit: "" }] })}>+ سطر</button>
              <button type="button" className="btn-primary" onClick={async () => {
                try {
                  await apiPost("/api/accounting/journals", { date: m.date, description: m.description, lines: m.lines.filter((l) => l.account_id).map((l) => ({ account_id: l.account_id, debit: l.debit || 0, credit: l.credit || 0 })), idempotency_key: mKey });
                  setMKey(newClientKey());
                  setM({ date: todayLocalISO(), description: "", lines: [{ account_id: "", debit: "", credit: "" }, { account_id: "", debit: "", credit: "" }] });
                  void qc.invalidateQueries({ queryKey: ["acc"] });
                } catch (err) { fail(toast, err); }
              }}>رحّل القيد</button>
            </div>
          </div>
        </details>
      )}
      {open && detail.data && (
        <section className="card p-4 flex flex-col gap-1 text-sm font-bold">
          <div className="flex justify-between"><span className="font-extrabold"><span dir="ltr">{detail.data.journal.number}</span> · {detail.data.journal.description}</span><button type="button" className="underline" onClick={() => setOpen(null)}>قفل</button></div>
          {detail.data.journal.lines?.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_6rem_6rem] gap-2">
              <span>{l.account.code} · {l.account.nameAr}{l.description ? ` — ${l.description}` : ""}</span>
              <span dir="ltr" className="text-end">{Number(l.debit) ? l.debit : ""}</span>
              <span dir="ltr" className="text-end">{Number(l.credit) ? l.credit : ""}</span>
            </div>
          ))}
          {detail.data.journal.reversedBy && <p className="text-united-danger">اتعكس بالقيد {detail.data.journal.reversedBy.number}</p>}
        </section>
      )}
      {q.isLoading && <LoadingState />}
      <ul className="flex flex-col gap-1">
        {q.data?.journals.map((j) => (
          <li key={j.id}>
            <button type="button" className="card p-2 w-full text-start flex justify-between gap-2 text-sm font-bold" onClick={() => setOpen(j.id)}>
              <span><span dir="ltr">{j.number}</span> · {j.date} · {SOURCE[j.sourceType] ?? j.sourceType} · {j.description}</span>
              <span dir="ltr">{fmtMoney(j.total)}</span>
            </button>
          </li>
        ))}
      </ul>
      {q.data && <Pagination page={jPage} pageSize={jPageSize} total={q.data.pagination?.total ?? 0} onChange={setJPage} />}
    </div>
  );
}

function Trial() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayLocalISO());
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["acc", "tb", from, to], queryFn: () => apiFetch<{ trialBalance: { lines: { account: { code: string; name: string; id: string }; opening: string; debit: string; credit: string; closing: string }[]; totals: { debit: string; credit: string }; balanced: boolean } }>(`/api/accounting/trial-balance?from=${from}&to=${to}`) });
  const ledger = useQuery({
    queryKey: ["acc", "ledger", activeAccount, from, to],
    queryFn: () => apiFetch<{ ledger: { lines: { date: string; number: string; description: string; debit: string; credit: string }[]; account: { code: string; nameAr: string }; opening: string; closing: string; pagination?: { total: number; limit: number; offset: number } } }>(`/api/accounting/accounts/${activeAccount}/ledger?from=${from}&to=${to}`),
    enabled: !!activeAccount,
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2"><input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {q.isLoading && <LoadingState />}
      {q.data && (
        <section className="card p-3 overflow-x-auto">
          {/* All shown amounts are formatted identically (2 decimals); a negative
              opening/closing balance means the account stands at credit — shown
              explicitly as "دائن" so the sign is never misread. */}
          {(() => { const fmt = (v: string) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 }); return (
          <table className="w-full text-sm font-bold">
            <thead><tr className="text-xs text-united-muted"><th className="p-1 text-start">الحساب</th><th className="p-1 text-end">أول المدة</th><th className="p-1 text-end">مدين</th><th className="p-1 text-end">دائن</th><th className="p-1 text-end">الرصيد</th></tr></thead>
            <tbody>
              {q.data.trialBalance.lines.map((l) => (
                <tr key={l.account.code} className="border-t border-united-dark/5 cursor-pointer hover:bg-united-dark/5" onClick={() => setActiveAccount(activeAccount === l.account.id ? null : l.account.id)}>
                  <td className="p-1">{l.account.code} · {l.account.name}</td>
                  {[l.opening, l.debit, l.credit, l.closing].map((v, i) => {
                    const n = Number(v);
                    const formatted = fmt(v);
                    const isBalanceColumn = i === 0 || i === 3;
                    const label = n < 0 && isBalanceColumn ? `دائن ${formatted.replace("-", "")}` : formatted;
                    return <td key={i} className={`p-1 text-end ${n < 0 && isBalanceColumn ? "text-united-danger/70" : ""}`} dir="ltr">{label}</td>;
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-united-dark/20 font-extrabold"><td className="p-1">الإجمالي {q.data.trialBalance.balanced ? "✓ متوازن" : "✗ غير متوازن"}</td><td /><td className="p-1 text-end" dir="ltr">{fmt(q.data.trialBalance.totals.debit)}</td><td className="p-1 text-end" dir="ltr">{fmt(q.data.trialBalance.totals.credit)}</td><td /></tr>
            </tbody>
          </table>
          ); })()}
        </section>
      )}
      {activeAccount && ledger.isLoading && <LoadingState />}
      {activeAccount && ledger.data && (
        <section className="card p-3 text-sm font-bold">
          <div className="flex justify-between mb-2">
            <span>دفتر أستاذ {ledger.data.ledger.account.nameAr} ({ledger.data.ledger.account.code}) — الحركات من {from} إلى {to}</span>
            <span className="font-extrabold">رصيد آخر المدة <span dir="ltr">{fmtMoney(ledger.data.ledger.closing)}</span></span>
          </div>
          {ledger.data.ledger.lines.length === 0 && <p className="text-united-muted">مفيش حركات في الفترة دي.</p>}
          <div className="flex flex-col gap-1">
            {ledger.data.ledger.lines.map((l) => (
              <div key={l.date + l.number + l.description} className="grid grid-cols-[1fr_6rem_6rem] gap-2">
                <span>{l.date} · <span dir="ltr">{l.number}</span> · {l.description}</span>
                <span dir="ltr" className="text-end">{Number(l.debit) ? fmtMoney(l.debit) : ""}</span>
                <span dir="ltr" className="text-end">{Number(l.credit) ? fmtMoney(l.credit) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VatSummary() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayLocalISO());
  const q = useQuery({ queryKey: ["acc", "vat", from, to], queryFn: () => apiFetch<{ summary: { from: string; to: string; lines: { taxCode: string; taxName: string; rate: string; outputBase: string; outputTax: string; inputBase: string; inputTax: string }[]; totals: { outputBase: string; outputTax: string; inputBase: string; inputTax: string; netPayable: string }; ledger: { outputDebit: string; outputCredit: string; outputExpectedCredit: string; outputDifference: string; inputDebit: string; inputCredit: string; inputExpectedDebit: string; inputDifference: string; reconciled: boolean } } }>(`/api/accounting/vat-summary?from=${from}&to=${to}`) });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2"><label className="text-xs font-bold">من <input type="date" className="field ms-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs font-bold">إلى <input type="date" className="field ms-1" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
      <p className="card p-3 text-sm font-bold text-united-warn">ملخص داخلي للمراجعة المحاسبية، وليس إقرارًا ضريبيًا رسميًا. راجع تصنيف الضريبة ومستندات الفترة مع المحاسب.</p>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && <>
        <section className={`card p-3 text-sm font-extrabold ${q.data.summary.ledger.reconciled ? "text-united-green" : "text-united-danger"}`}>
          {q.data.summary.ledger.reconciled ? "ضريبة المستندات مطابقة لحركة حسابي الضريبة في الأستاذ العام" : `فرق يحتاج مراجعة — مخرجات ${fmtMoney(q.data.summary.ledger.outputDifference)} · مدخلات ${fmtMoney(q.data.summary.ledger.inputDifference)}`}
        </section>
        <section className="card p-3 overflow-x-auto">
          <table className="w-full text-sm font-bold">
            <thead><tr className="text-xs text-united-muted text-end"><th className="p-2 text-start">التصنيف</th><th className="p-2">النسبة</th><th className="p-2">مبيعات خاضعة</th><th className="p-2">ضريبة مخرجات</th><th className="p-2">مشتريات خاضعة</th><th className="p-2">ضريبة مدخلات</th></tr></thead>
            <tbody>{q.data.summary.lines.map((line) => <tr key={`${line.taxCode}-${line.rate}`} className="border-t border-united-border"><td className="p-2 text-start">{line.taxName} · {line.taxCode}</td><td className="p-2 text-end" dir="ltr">{line.rate}%</td><td className="p-2 text-end" dir="ltr">{fmtMoney(line.outputBase)}</td><td className="p-2 text-end" dir="ltr">{fmtMoney(line.outputTax)}</td><td className="p-2 text-end" dir="ltr">{fmtMoney(line.inputBase)}</td><td className="p-2 text-end" dir="ltr">{fmtMoney(line.inputTax)}</td></tr>)}
              <tr className="border-t-2 border-united-dark/20 font-extrabold"><td className="p-2 text-start">الإجمالي</td><td /><td className="p-2 text-end" dir="ltr">{fmtMoney(q.data.summary.totals.outputBase)}</td><td className="p-2 text-end" dir="ltr">{fmtMoney(q.data.summary.totals.outputTax)}</td><td className="p-2 text-end" dir="ltr">{fmtMoney(q.data.summary.totals.inputBase)}</td><td className="p-2 text-end" dir="ltr">{fmtMoney(q.data.summary.totals.inputTax)}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card p-3 flex flex-wrap justify-between gap-2 text-sm font-extrabold"><span>صافي ضريبة الفترة المستحق</span><span dir="ltr">{fmtMoney(q.data.summary.totals.netPayable)} ج.م</span></section>
        <p className="text-xs font-bold text-united-muted">المقارنة تعرض رصيد الحركة في حساب 2200 للمخرجات و1500 للمدخلات خلال الفترة، بما يشمل أي قيد دفتر أستاذ مسجل عليهما.</p>
      </>}
    </div>
  );
}

function Periods() {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["acc", "periods"], queryFn: () => apiFetch<{ periods: { id: string; code: string; status: string; closedBy: string | null }[] }>("/api/accounting/periods") });
  const run = async (path: string, done: string) => {
    try { await apiPost(path, {}); toast.show(done, "success"); void qc.invalidateQueries({ queryKey: ["acc"] }); } catch (err) { fail(toast, err); }
  };
  return (
    <div className="flex flex-col gap-3">
      {can("accounting.manage") && (
        <section className="card p-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => run("/api/accounting/stock-valuation", "اترحّل تقييم المخزون")}>ترحيل تقييم المخزون</button>
          <button type="button" className="btn-secondary" onClick={() => run("/api/accounting/sync", "اترحّلت المستندات الناقصة")}>ترحيل أي مستندات ناقصة</button>
        </section>
      )}
      <ul className="flex flex-col gap-2">
        {q.data?.periods.map((p) => (
          <li key={p.id} className="card p-3 flex justify-between items-center font-bold">
            <span dir="ltr">{p.code}</span>
            <span className={p.status === "open" ? "text-united-green" : "text-united-muted"}>{p.status === "open" ? "مفتوحة" : `مقفولة (${p.closedBy})`}</span>
            {p.status === "open" && can("accounting.periods.close") && <button type="button" className="btn-danger" onClick={() => run(`/api/accounting/periods/${p.code}/close`, `اتقفلت ${p.code}`)}>قفل</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reconcile() {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ cash_account_id: "bank_main", statement_date: todayLocalISO(), statement_balance: "" });
  const [recId, setRecId] = useState<string | null>(null);
  const rec = useQuery({ queryKey: ["acc", "rec", recId], queryFn: () => apiFetch<{ reconciliation: { status: string; statementBalance: string; clearedBalance: string; difference: string; lines: { id: string; date: string; number: string; description: string; debit: string; credit: string; cleared: boolean }[] } }>(`/api/accounting/reconciliations/${recId}`), enabled: !!recId });
  const mark = async (ids: string[], cleared: boolean) => {
    try { await apiPost(`/api/accounting/reconciliations/${recId}/mark`, { line_ids: ids, cleared }); void qc.invalidateQueries({ queryKey: ["acc", "rec", recId] }); } catch (err) { fail(toast, err); }
  };
  if (!recId) {
    return (
      <section className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Field label="الحساب"><select className="field" value={form.cash_account_id} onChange={(e) => setForm({ ...form, cash_account_id: e.target.value })}><option value="bank_main">الحساب البنكي</option><option value="cash_main">الخزينة</option></select></Field>
        <Field label="تاريخ الكشف"><input type="date" className="field" value={form.statement_date} onChange={(e) => setForm({ ...form, statement_date: e.target.value })} /></Field>
        <Field label="رصيد الكشف"><input className="field" dir="ltr" inputMode="decimal" value={form.statement_balance} onChange={(e) => setForm({ ...form, statement_balance: e.target.value })} /></Field>
        <button type="button" className="btn-primary self-end" onClick={async () => {
          try { const r = await apiPost<{ reconciliation: { id: string } }>("/api/accounting/reconciliations", form); setRecId(r.reconciliation.id); } catch (err) { fail(toast, err); }
        }}>ابدأ التسوية</button>
      </section>
    );
  }
  const r = rec.data?.reconciliation;
  if (!r) return <LoadingState />;
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 grid grid-cols-3 gap-2 font-bold text-sm">
        <div>رصيد الكشف <div dir="ltr" className="text-lg font-extrabold">{fmtMoney(r.statementBalance)}</div></div>
        <div>المطابق في الدفاتر <div dir="ltr" className="text-lg font-extrabold">{fmtMoney(r.clearedBalance)}</div></div>
        <div>الفرق <div dir="ltr" className={`text-lg font-extrabold ${Number(r.difference) ? "text-united-danger" : "text-united-green"}`}>{fmtMoney(r.difference)}</div></div>
      </section>
      <ul className="card p-3 flex flex-col divide-y divide-united-dark/5 text-sm font-bold">
        {r.lines.map((l) => (
          <li key={l.id} className="py-1 flex items-center gap-2">
            <input type="checkbox" className="w-5 h-5" checked={l.cleared} disabled={r.status !== "open"} onChange={() => mark([l.id], !l.cleared)} aria-label={l.number} />
            <span className="flex-1">{l.date} · <span dir="ltr">{l.number}</span> · {l.description}</span>
            <span dir="ltr">{Number(l.debit) ? `+${l.debit}` : `-${l.credit}`}</span>
          </li>
        ))}
        {r.lines.length === 0 && <EmptyState icon="🏦" title="مفيش حركات للتسوية" />}
      </ul>
      {r.status === "open" && <button type="button" className="btn-primary" onClick={async () => {
        try { await apiPost(`/api/accounting/reconciliations/${recId}/complete`, {}); toast.show("التسوية خلصت", "success"); void qc.invalidateQueries({ queryKey: ["acc"] }); } catch (err) { fail(toast, err); }
      }}>إنهاء التسوية</button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accounts health: every subledger against its GL account
// ---------------------------------------------------------------------------

type Check = { key: string; label: string; ok: boolean; subledger?: string; ledger?: string; difference?: string; count?: number; detail?: unknown };

function Health() {
  const q = useQuery({ queryKey: ["acc", "integrity"], queryFn: () => apiFetch<{ integrity: { ok: boolean; checkedAt: string; checks: Check[] } }>("/api/accounting/integrity") });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const r = q.data.integrity;
  return (
    <div className="flex flex-col gap-3">
      <section className={`card p-4 font-extrabold ${r.ok ? "bg-united-green/10 text-united-green" : "bg-united-danger/10 text-united-danger"}`}>
        {r.ok ? "✓ الدفاتر متطابقة: كل الأقسام بتقرا نفس الأرقام" : "✗ فيه اختلاف لازم يتراجع — التفاصيل تحت"}
        <div className="text-xs font-bold text-united-muted mt-1">آخر فحص {new Date(r.checkedAt).toLocaleString("ar-EG")}</div>
      </section>
      <ul className="flex flex-col gap-2">
        {r.checks.map((c) => (
          <li key={c.key} className="card p-3 flex flex-col gap-1 text-sm font-bold">
            <div className="flex justify-between gap-2"><span>{c.ok ? "✓" : "✗"} {c.label}</span>{c.count !== undefined && <span>{c.count}</span>}</div>
            {c.subledger !== undefined && c.ledger !== undefined && (
              <div className="text-xs text-united-muted flex flex-wrap gap-3">
                <span>المستندات <span dir="ltr">{fmtMoney(c.subledger)}</span></span>
                <span>الأستاذ <span dir="ltr">{fmtMoney(c.ledger)}</span></span>
                {c.difference !== undefined && <span className={Number(c.difference) ? "text-united-danger" : ""}>الفرق <span dir="ltr">{fmtMoney(c.difference)}</span></span>}
              </div>
            )}
            {c.key !== "grni" && c.subledger === undefined && c.ledger !== undefined && <div className="text-xs text-united-muted" dir="ltr">{fmtMoney(c.ledger)}</div>}
            {c.key === "grni" && <div className="text-xs text-united-muted">قيمة بضاعة استلمناها ولسه فاتورتها مجتش: <span dir="ltr">{fmtMoney(c.ledger)}</span></div>}
            {!c.ok && Array.isArray(c.detail) && c.detail.length > 0 && <pre className="text-xs whitespace-pre-wrap text-united-danger" dir="ltr">{JSON.stringify(c.detail, null, 1)}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Go-live: balances and stock brought over from the old system
// ---------------------------------------------------------------------------

function Opening() {
  const toast = useToast();
  const qc = useQueryClient();
  const customers = useQuery({ queryKey: ["acc", "parties", "receipts"], queryFn: () => apiFetch<{ customers: { id: string; code: string; name: string }[] }>("/api/sales/customers").then((r) => r.customers) });
  const suppliers = useQuery({ queryKey: ["acc", "parties", "payments"], queryFn: () => apiFetch<{ suppliers: { id: string; code: string; name: string }[] }>("/api/purchasing/suppliers").then((r) => r.suppliers) });
  const products = useQuery({ queryKey: ["acc", "products"], queryFn: () => apiFetch<{ products: { id: string; name: string; unit: string }[] }>("/api/stock/products").then((r) => r.products) });
  const list = useQuery({ queryKey: ["acc", "opening"], queryFn: () => apiFetch<{ openingBalances: { id: string; partyType: string; date: string; amount: string; reference: string | null; party: { code: string; name: string } | null }[] }>("/api/accounting/opening-balances") });
  const [b, setB] = useState({ party_type: "customer", party_id: "", amount: "", date: todayLocalISO(), due_date: "", reference: "" });
  const [bKey, setBKey] = useState(newClientKey);
  const [sKey, setSKey] = useState(newClientKey);
  const [stock, setStock] = useState<{ product_id: string; quantity: string; unit_cost: string; expiry_date: string }[]>([{ product_id: "", quantity: "", unit_cost: "", expiry_date: "" }]);
  const parties = b.party_type === "customer" ? customers.data : suppliers.data;
  const done = (msg: string) => { toast.show(msg, "success"); void qc.invalidateQueries({ queryKey: ["acc"] }); };
  const fail = (err: unknown) => toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-united-muted">لليوم اللي هنبدأ فيه: أرصدة العملاء والموردين والمخزون من النظام القديم. كل رصيد بيظهر في كشف حساب الطرف وفي الأستاذ في نفس الوقت (مقابل حساب الأرصدة الافتتاحية). الخزينة والبنك ورأس المال بقيد يدوي.</p>
      <section className="card p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <h3 className="font-extrabold col-span-full">رصيد عميل / مورد</h3>
        <Field label="النوع"><select className="field" value={b.party_type} onChange={(e) => setB({ ...b, party_type: e.target.value, party_id: "" })}><option value="customer">عميل</option><option value="supplier">مورد</option></select></Field>
        <Field label={b.party_type === "customer" ? "العميل" : "المورد"}><select className="field" value={b.party_id} onChange={(e) => setB({ ...b, party_id: e.target.value })}><option value="">— اختار —</option>{parties?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></Field>
        <Field label={b.party_type === "customer" ? "المبلغ المستحق عليه (سالب لو ليه رصيد دائن)" : "المبلغ المستحق له (سالب لو علينا رصيد مدين عنده)"}><input className="field" dir="ltr" inputMode="decimal" value={b.amount} onChange={(e) => setB({ ...b, amount: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" className="field" value={b.date} onChange={(e) => setB({ ...b, date: e.target.value })} /></Field>
        <Field label="الاستحقاق"><input type="date" className="field" value={b.due_date} onChange={(e) => setB({ ...b, due_date: e.target.value })} /></Field>
        <Field label="المرجع"><input className="field" value={b.reference} onChange={(e) => setB({ ...b, reference: e.target.value })} /></Field>
        <button type="button" className="btn-primary col-span-full" disabled={!b.party_id || !b.amount} onClick={async () => {
          try { await apiPost("/api/accounting/opening-balances", { ...b, due_date: b.due_date || undefined, reference: b.reference || null, idempotency_key: bKey }); setBKey(newClientKey()); setB({ ...b, party_id: "", amount: "", reference: "" }); done("اتسجل الرصيد الافتتاحي"); } catch (err) { fail(err); }
        }}>سجّل الرصيد</button>
      </section>
      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-extrabold">مخزون افتتاحي</h3>
        {stock.map((l, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select className="field" value={l.product_id} onChange={(e) => setStock(stock.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}><option value="">الصنف</option>{products.data?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select>
            <input className="field" dir="ltr" inputMode="decimal" placeholder="الكمية" value={l.quantity} onChange={(e) => setStock(stock.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            <input className="field" dir="ltr" inputMode="decimal" placeholder="تكلفة الوحدة" value={l.unit_cost} onChange={(e) => setStock(stock.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)))} />
            <input type="date" className="field" aria-label="الانتهاء" value={l.expiry_date} onChange={(e) => setStock(stock.map((x, j) => (j === i ? { ...x, expiry_date: e.target.value } : x)))} />
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => setStock([...stock, { product_id: "", quantity: "", unit_cost: "", expiry_date: "" }])}>+ صنف</button>
          <button type="button" className="btn-primary" onClick={async () => {
            try { await apiPost("/api/accounting/opening-stock", { lines: stock.filter((l) => l.product_id).map((l) => ({ ...l, expiry_date: l.expiry_date || undefined })), idempotency_key: sKey }); setSKey(newClientKey()); setStock([{ product_id: "", quantity: "", unit_cost: "", expiry_date: "" }]); done("المخزون الافتتاحي اتسجل"); } catch (err) { fail(err); }
          }}>سجّل المخزون</button>
        </div>
      </section>
      <ul className="flex flex-col gap-1 text-sm font-bold">
        {list.data?.openingBalances.map((o) => (
          <li key={o.id} className="card p-2 flex justify-between"><span>{o.partyType === "customer" ? "عميل" : "مورد"} · {o.party?.name} · {o.date}{o.reference ? ` · ${o.reference}` : ""}</span><span dir="ltr">{fmtMoney(o.amount)}</span></li>
        ))}
      </ul>
    </div>
  );
}
