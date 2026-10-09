"use client";

import { useState } from "react";
import { newClientKey } from "@/lib/clientKey";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError } from "@/lib/api-client";
import { EmptyState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { todayLocalISO } from "@/lib/localDate";
import { Field, Tabs, fmtMoney } from "@/components/stock/inventory/shared";

/** Expenses (record; above the threshold they wait for approval) and employees (advances, reimbursements, balances). */

const fail = (toast: ReturnType<typeof useToast>, err: unknown) => toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
const STATUS: Record<string, { label: string; cls: string }> = { pending_approval: { label: "مستني اعتماد", cls: "text-united-warn" }, approved: { label: "معتمد ومترحّل", cls: "text-united-green" }, rejected: { label: "مرفوض", cls: "text-united-danger" } };
const MODE: Record<string, string> = { cash: "من الخزينة", reimburse: "يتردّ للموظف", advance: "من سلفة الموظف" };
type Emp = { id: string; code: string; name: string; jobTitle: string | null; active: boolean; balance: string; department: { name: string } | null };

export function HrView() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<"expenses" | "employees">("expenses");
  return (
    <div className="p-4 max-w-5xl mx-auto pb-10 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-united-dark">الموظفين والمصروفات</h1>
      {can("hr.employees.manage") && <Tabs value={tab} onChange={setTab} items={[{ key: "expenses", label: "المصروفات" }, { key: "employees", label: "الموظفين" }]} />}
      {tab === "expenses" ? <Expenses /> : <Employees />}
    </div>
  );
}

const useEmployees = () => useQuery({ queryKey: ["hr", "employees"], queryFn: () => apiFetch<{ employees: Emp[]; departments: { id: string; code: string; name: string }[] }>("/api/hr/employees") });

function Expenses() {
  const toast = useToast();
  const qc = useQueryClient();
  const emps = useEmployees();
  const accounts = useQuery({ queryKey: ["hr", "expense-accounts"], queryFn: () => apiFetch<{ accounts: { id: string; code: string; nameAr: string; type: string; postable: boolean }[] }>("/api/hr/expense-accounts").then((r) => r.accounts) });
  const list = useQuery({ queryKey: ["hr", "expenses"], queryFn: () => apiFetch<{ expenses: { id: string; number: string; date: string; amount: string; description: string; paymentMode: string; status: string; createdBy: string; employee: { name: string } | null; account: { code: string; nameAr: string } | null }[] }>("/api/hr/expenses") });
  const [f, setF] = useState({ date: todayLocalISO(), account_id: "", amount: "", description: "", payment_mode: "cash", cash_account_id: "cash_main", employee_id: "" });
  const [fKey, setFKey] = useState(newClientKey);
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Field label="البند"><select className="field" value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}><option value="">— اختار —</option>{accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.nameAr}</option>)}</select></Field>
        <Field label="المبلغ"><input className="field" dir="ltr" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" className="field" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="البيان"><input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="اتدفع إزاي"><select className="field" value={f.payment_mode} onChange={(e) => setF({ ...f, payment_mode: e.target.value })}>{Object.entries(MODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {f.payment_mode === "cash" ? (
          <Field label="الخزينة"><select className="field" value={f.cash_account_id} onChange={(e) => setF({ ...f, cash_account_id: e.target.value })}><option value="cash_main">الخزينة الرئيسية</option><option value="bank_main">الحساب البنكي</option></select></Field>
        ) : (
          <Field label="الموظف"><select className="field" value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}><option value="">— اختار —</option>{emps.data?.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        )}
        <button type="button" className="btn-primary col-span-full" disabled={!f.account_id || !f.amount || !f.description} onClick={async () => {
          try {
            const r = await apiPost<{ expense: { number: string; status: string } }>("/api/hr/expenses", { ...f, employee_id: f.employee_id || undefined, cash_account_id: f.payment_mode === "cash" ? f.cash_account_id : undefined, idempotency_key: fKey });
            setFKey(newClientKey());
            toast.show(`${r.expense.number} · ${STATUS[r.expense.status].label}`, "success");
            setF({ ...f, amount: "", description: "" });
            void qc.invalidateQueries({ queryKey: ["hr"] });
          } catch (err) { fail(toast, err); }
        }}>سجّل المصروف</button>
      </section>
      {list.isLoading && <LoadingState />}
      {list.data?.expenses.length === 0 && <EmptyState icon="🧾" title="مفيش مصروفات" />}
      <ul className="flex flex-col gap-2">
        {list.data?.expenses.map((e) => (
          <li key={e.id} className="card p-3 flex justify-between gap-2 text-sm font-bold">
            <div>
              <div className="font-extrabold"><span dir="ltr">{e.number}</span> · {e.description}</div>
              <div className="text-xs text-united-muted">{e.date} · {e.account?.nameAr} · {MODE[e.paymentMode]}{e.employee ? ` · ${e.employee.name}` : ""} · {e.createdBy} · <span className={STATUS[e.status]?.cls}>{STATUS[e.status]?.label}</span></div>
            </div>
            <span dir="ltr" className="font-extrabold">{fmtMoney(e.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Employees() {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useEmployees();
  const [n, setN] = useState({ name: "", job_title: "", phone: "", department_id: "" });
  const [t, setT] = useState({ employee_id: "", type: "advance", amount: "", cash_account_id: "cash_main" });
  const [tKey, setTKey] = useState(newClientKey);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["hr"] });
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input className="field" placeholder="الاسم" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input className="field" placeholder="الوظيفة" value={n.job_title} onChange={(e) => setN({ ...n, job_title: e.target.value })} />
        <input className="field" dir="ltr" placeholder="التليفون" value={n.phone} onChange={(e) => setN({ ...n, phone: e.target.value })} />
        <select className="field" value={n.department_id} onChange={(e) => setN({ ...n, department_id: e.target.value })}><option value="">القسم</option>{q.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <button type="button" className="btn-secondary" disabled={!n.name} onClick={async () => {
          try { await apiPost("/api/hr/employees", { name: n.name, job_title: n.job_title || null, phone: n.phone || null, department_id: n.department_id || null }); setN({ name: "", job_title: "", phone: "", department_id: "" }); refresh(); } catch (err) { fail(toast, err); }
        }}>+ موظف</button>
      </section>
      {can("hr.advances.manage") && (
        <section className="card p-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select className="field" value={t.employee_id} onChange={(e) => setT({ ...t, employee_id: e.target.value })}><option value="">الموظف</option>{q.data?.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select className="field" value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })}><option value="advance">صرف سلفة</option><option value="reimbursement">صرف مستحقات</option><option value="advance_return">رد سلفة</option></select>
          <input className="field" dir="ltr" inputMode="decimal" placeholder="المبلغ" value={t.amount} onChange={(e) => setT({ ...t, amount: e.target.value })} />
          <select className="field" value={t.cash_account_id} onChange={(e) => setT({ ...t, cash_account_id: e.target.value })}><option value="cash_main">الخزينة</option><option value="bank_main">البنك</option></select>
          <button type="button" className="btn-primary" disabled={!t.employee_id || !t.amount} onClick={async () => {
            try { await apiPost("/api/hr/transactions", { ...t, idempotency_key: tKey }); setTKey(newClientKey()); setT({ ...t, amount: "" }); refresh(); toast.show("اتسجل", "success"); } catch (err) { fail(toast, err); }
          }}>سجّل</button>
        </section>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {q.data?.employees.map((e) => (
          <li key={e.id} className={`card p-3 flex justify-between text-sm font-bold ${e.active ? "" : "opacity-60"}`}>
            <span><span dir="ltr">{e.code}</span> · {e.name}{e.jobTitle ? ` · ${e.jobTitle}` : ""}{e.department ? ` · ${e.department.name}` : ""}</span>
            <span dir="ltr" className={Number(e.balance) > 0 ? "text-united-warn" : Number(e.balance) < 0 ? "text-united-danger" : ""} title="موجب = سلفة معاه، سالب = مستحق له">{fmtMoney(e.balance)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
