"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { todayLocalISO } from "@/lib/localDate";
import { Field, Tabs, fmtQty } from "@/components/stock/inventory/shared";

/**
 * Distribution: trips (plan → load → dispatch → deliver), delivery results, the
 * exception list and the fleet. Quantities only — no prices anywhere on this screen.
 * Each action is shown to whoever may take it; the server enforces the same.
 */

type Tab = "trips" | "exceptions" | "fleet";
const fail = (toast: ReturnType<typeof useToast>, err: unknown) => toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");

const TRIP_STATUS: Record<string, { label: string; cls: string }> = {
  planned: { label: "متخططة", cls: "bg-united-dark/5" },
  loading: { label: "بتتحمل", cls: "bg-united-warn/10 text-united-warn" },
  loaded: { label: "اتحملت", cls: "bg-blue-50 text-blue-700" },
  dispatched: { label: "خرجت", cls: "bg-blue-50 text-blue-700" },
  in_transit: { label: "في الطريق", cls: "bg-blue-50 text-blue-700" },
  completed: { label: "خلصت", cls: "bg-united-green/10 text-united-green" },
  cancelled: { label: "ملغية", cls: "bg-united-danger/10 text-united-danger" },
};
const STOP_STATUS: Record<string, string> = { pending: "لسه", delivered: "اتسلم", partial: "اتسلم جزئي", failed: "فشل التسليم" };
const EX_TYPE: Record<string, string> = { shortage: "عجز", damage: "تالف", rejection: "رفض العميل", delivery_failure: "فشل التسليم", loading_discrepancy: "فرق تحميل" };

type Fleet = { vehicles: { id: string; code: string; plate: string; type: string; capacityKg: string | null; refrigerated: boolean; active: boolean; version: number }[]; drivers: { id: string; name: string; phone: string | null; active: boolean; version: number }[] };
type TripRow = { id: string; number: string; status: string; tripDate: string; vehicle: { code: string; plate: string; refrigerated: boolean }; driver: { name: string }; stops: number; delivered: number };
type Item = { id: string; productName: string; unit: string; requiredQuantity: number; preparedQuantity: number | null; loadedQuantity: number | null; shippedQty: string };
type Stop = { id: string; sequence: number; orderId: string; status: string; crateCount: number | null; receiverName: string | null; failureReason: string | null; recordedBy: string | null; lines: { orderItemId: string; deliveredQty: string; shortageQty: string; damagedQty: string; rejectedQty: string }[]; order: { id: string; orderNumber: string; customerName: string; status: string; crateCount: number | null; items: Item[] } };
type TripDetail = { id: string; number: string; status: string; tripDate: string; notes: string | null; cancelReason: string | null; version: number; vehicle: Fleet["vehicles"][number]; driver: Fleet["drivers"][number]; stops: Stop[] };

export function OperationsView() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("trips");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "exceptions" || t === "fleet") setTab(t);
  }, []);
  return (
    <div className="p-4 max-w-5xl mx-auto pb-10 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-united-dark">التوزيع</h1>
      <Tabs value={tab} onChange={setTab} items={[{ key: "trips", label: "الرحلات" }, { key: "exceptions", label: "الاستثناءات" }, ...(can("operations.trips.manage") ? [{ key: "fleet" as Tab, label: "العربيات والسواقين" }] : [])]} />
      {tab === "trips" ? <Trips /> : tab === "exceptions" ? <Exceptions /> : <FleetView />}
    </div>
  );
}

const useFleet = () => useQuery({ queryKey: ["ops", "fleet"], queryFn: () => apiFetch<Fleet>("/api/operations/fleet") });

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

function Trips() {
  const { can } = usePermissions();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ["ops", "trips", all], queryFn: () => apiFetch<{ trips: TripRow[] }>(`/api/operations/trips${all ? "" : "?open=1"}`) });
  if (open) return <TripView id={open} onClose={() => setOpen(null)} />;
  if (creating) return <NewTrip onDone={(id) => { setCreating(false); if (id) setOpen(id); }} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        <div className="flex-1"><Tabs value={all ? "all" : "open"} onChange={(v) => setAll(v === "all")} items={[{ key: "open", label: "شغالة" }, { key: "all", label: "الكل" }]} /></div>
        {can("operations.trips.manage") && <button type="button" className="btn-primary shrink-0" onClick={() => setCreating(true)}>+ رحلة</button>}
      </div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.trips.length === 0 && <EmptyState icon="🚚" title="مفيش رحلات" />}
      <ul className="flex flex-col gap-2">
        {q.data?.trips.map((t) => (
          <li key={t.id}>
            <button type="button" className="card p-3 w-full text-start flex justify-between gap-2" onClick={() => setOpen(t.id)}>
              <div>
                <div className="font-extrabold"><span dir="ltr">{t.number}</span> · {t.vehicle.code}{t.vehicle.refrigerated ? " ❄️" : ""} · {t.driver.name}</div>
                <div className="text-xs font-bold text-united-muted">{t.tripDate} · {t.stops} أوردر · اتسلم {t.delivered}</div>
              </div>
              <span className={`self-start rounded-full px-2 text-xs font-extrabold ${TRIP_STATUS[t.status]?.cls}`}>{TRIP_STATUS[t.status]?.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewTrip({ onDone }: { onDone: (id?: string) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const fleet = useFleet();
  const [date, setDate] = useState(todayLocalISO());
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const orders = useQuery({ queryKey: ["ops", "plannable", date], queryFn: () => apiFetch<{ orders: { id: string; orderNumber: string; customerName: string; status: string; deliveryTime: string | null }[] }>(`/api/operations/trips/plannable?date=${date}`) });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center"><h2 className="text-xl font-extrabold">رحلة جديدة</h2><button type="button" className="btn-secondary" onClick={() => onDone()}>رجوع</button></div>
      <section className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="التاريخ"><input type="date" className="field" value={date} onChange={(e) => { setDate(e.target.value); setPicked([]); }} /></Field>
        <Field label="العربية">
          <select className="field font-bold" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— اختار —</option>
            {fleet.data?.vehicles.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.code} · {v.plate}{v.refrigerated ? " ❄️" : ""}{v.capacityKg ? ` · ${Number(v.capacityKg)} كجم` : ""}</option>)}
          </select>
        </Field>
        <Field label="السواق">
          <select className="field font-bold" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">— اختار —</option>
            {fleet.data?.drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </section>
      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-extrabold">الأوردرات (بترتيب التسليم)</h3>
        {orders.data?.orders.length === 0 && <p className="text-sm font-bold text-united-muted">مفيش أوردرات ليوم {date} من غير رحلة.</p>}
        {orders.data?.orders.map((o) => {
          const n = picked.indexOf(o.id);
          return (
            <button key={o.id} type="button" onClick={() => toggle(o.id)} aria-pressed={n >= 0} className={`tap-target rounded-xl px-3 text-start font-bold flex justify-between ${n >= 0 ? "bg-united-green text-white" : "bg-united-dark/5"}`}>
              <span>{n >= 0 ? `${n + 1}. ` : ""}<span dir="ltr">{o.orderNumber}</span> · {o.customerName}{o.deliveryTime ? ` · ${o.deliveryTime}` : ""}</span>
              <span className="text-xs">{o.status}</span>
            </button>
          );
        })}
        <button type="button" className="btn-primary" disabled={!vehicleId || !driverId || picked.length === 0} onClick={async () => {
          try {
            const r = await apiPost<{ trip: { id: string; number: string } }>("/api/operations/trips", { trip_date: date, vehicle_id: vehicleId, driver_id: driverId, order_ids: picked });
            toast.show(`اتعملت ${r.trip.number}`, "success");
            void qc.invalidateQueries({ queryKey: ["ops"] });
            onDone(r.trip.id);
          } catch (err) { fail(toast, err); }
        }}>اعمل الرحلة</button>
      </section>
    </div>
  );
}

function TripView({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const [crates, setCrates] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [pod, setPod] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["ops", "trip", id], queryFn: () => apiFetch<{ trip: TripDetail }>(`/api/operations/trips/${id}`) });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const t = q.data.trip;
  const act = async (path: string, body: Record<string, unknown> = {}) => {
    try { await apiPost(`/api/operations/trips/${id}/${path}`, body); void qc.invalidateQueries({ queryKey: ["ops"] }); } catch (err) { fail(toast, err); }
  };
  const stop = t.stops.find((s) => s.id === pod);
  if (stop) return <DeliveryForm stop={stop} onDone={() => { setPod(null); void qc.invalidateQueries({ queryKey: ["ops"] }); }} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-extrabold" dir="ltr">{t.number}</h2>
          <p className="text-sm font-bold text-united-muted">{t.tripDate} · {t.vehicle.code} · <span dir="ltr">{t.vehicle.plate}</span>{t.vehicle.refrigerated ? " ❄️" : ""} · {t.driver.name}{t.driver.phone ? <> · <span dir="ltr">{t.driver.phone}</span></> : null}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>رجوع</button>
      </div>
      <span className={`self-start rounded-full px-3 py-1 text-sm font-extrabold ${TRIP_STATUS[t.status]?.cls}`}>{TRIP_STATUS[t.status]?.label}{t.cancelReason ? ` · ${t.cancelReason}` : ""}</span>
      <ol className="flex flex-col gap-2">
        {t.stops.map((s) => (
          <li key={s.id} className="card p-3 flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <div className="font-extrabold">{s.sequence}. <span dir="ltr">{s.order.orderNumber}</span> · {s.order.customerName}</div>
              <span className="text-xs font-extrabold text-united-muted">{s.order.status} · {STOP_STATUS[s.status]}</span>
            </div>
            <ul className="text-sm font-bold text-united-muted">
              {s.order.items.map((i) => {
                const l = s.lines.find((x) => x.orderItemId === i.id);
                return (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span>{i.productName}</span>
                    <span dir="ltr">{fmtQty(i.requiredQuantity)} → {fmtQty(i.preparedQuantity)} → {fmtQty(i.loadedQuantity)}{l ? ` → ✓${fmtQty(l.deliveredQty)}` : ""} {i.unit}</span>
                  </li>
                );
              })}
            </ul>
            {s.receiverName && <p className="text-xs font-bold">استلم: {s.receiverName} · سجّل: {s.recordedBy}</p>}
            {s.failureReason && <p className="text-xs font-bold text-united-danger">{s.failureReason}</p>}
            {t.status === "loaded" && can("orders.dispatch") && (
              <input className="field w-40" dir="ltr" inputMode="numeric" placeholder="عدد البرنيكة" aria-label={`برنيكة ${s.order.orderNumber}`} value={crates[s.orderId] ?? (s.order.crateCount ? String(s.order.crateCount) : "")} onChange={(e) => setCrates({ ...crates, [s.orderId]: e.target.value })} />
            )}
            {["dispatched", "in_transit"].includes(t.status) && s.status === "pending" && can("orders.dispatch") && (
              <button type="button" className="btn-primary self-start" onClick={() => setPod(s.id)}>سجّل التسليم</button>
            )}
          </li>
        ))}
      </ol>
      <section className="card p-4 flex flex-wrap gap-2">
        {["planned", "loading"].includes(t.status) && can("orders.load") && <button type="button" className="btn-primary" onClick={() => act("start-loading")}>ابدأ التحميل</button>}
        {t.status === "loading" && can("orders.load") && <button type="button" className="btn-primary" onClick={() => act("loaded")}>تأكيد إن الرحلة اتحملت</button>}
        {t.status === "loaded" && can("orders.dispatch") && (
          <button type="button" className="btn-primary" onClick={() => act("dispatch", { crates: Object.fromEntries(t.stops.map((s) => [s.orderId, Number(crates[s.orderId] ?? s.order.crateCount ?? 0)]).filter(([, n]) => Number(n) > 0)) })}>خروج الرحلة</button>
        )}
        {t.status === "dispatched" && can("orders.dispatch") && <button type="button" className="btn-secondary" onClick={() => act("depart")}>في الطريق</button>}
        {["planned", "loading", "loaded"].includes(t.status) && can("operations.trips.manage") && (
          <>
            <input className="field flex-1 min-w-48" placeholder="سبب الإلغاء" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="button" className="btn-danger" onClick={() => act("cancel", { reason })}>إلغاء الرحلة</button>
          </>
        )}
      </section>
    </div>
  );
}

/** What happened at the customer: by default everything delivered; type what was not. */
function DeliveryForm({ stop, onDone }: { stop: Stop; onDone: () => void }) {
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState("");
  const [lines, setLines] = useState<Record<string, { shortage_qty: string; damaged_qty: string; rejected_qty: string; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  const set = (id: string, k: "shortage_qty" | "damaged_qty" | "rejected_qty" | "reason", v: string) => setLines({ ...lines, [id]: { ...(lines[id] ?? { shortage_qty: "", damaged_qty: "", rejected_qty: "", reason: "" }), [k]: v } });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center"><h2 className="text-xl font-extrabold">تسليم <span dir="ltr">{stop.order.orderNumber}</span> · {stop.order.customerName}</h2><button type="button" className="btn-secondary" onClick={onDone}>رجوع</button></div>
      <Tabs value={failed ? "failed" : "ok"} onChange={(v) => setFailed(v === "failed")} items={[{ key: "ok", label: "اتسلم" }, { key: "failed", label: "فشل التسليم" }]} />
      {failed ? (
        <section className="card p-4"><Field label="سبب فشل التسليم (كل البضاعة بترجع المخزن)"><input className="field" value={failure} onChange={(e) => setFailure(e.target.value)} /></Field></section>
      ) : (
        <>
          <section className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="اسم المستلم"><input className="field" value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
            <Field label="ملاحظات العميل"><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </section>
          <section className="card p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-united-muted">سيب الخانات فاضية لو الصنف اتسلم كله. المرفوض بيرجع المخزن، العجز والتالف بيتسجلوا استثناء.</p>
            {stop.order.items.filter((i) => Number(i.shippedQty) > 0).map((i) => {
              const l = lines[i.id];
              const left = Number(i.shippedQty) - Number(l?.shortage_qty || 0) - Number(l?.damaged_qty || 0) - Number(l?.rejected_qty || 0);
              return (
                <div key={i.id} className="flex flex-col gap-1 border-b border-united-dark/5 pb-2">
                  <div className="flex justify-between font-extrabold text-sm"><span>{i.productName}</span><span dir="ltr">خرج {fmtQty(i.shippedQty, i.unit)} · اتسلم {fmtQty(left, i.unit)}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["shortage_qty", "damaged_qty", "rejected_qty"] as const).map((k) => (
                      <input key={k} className="field" dir="ltr" inputMode="decimal" aria-label={`${k} ${i.productName}`} placeholder={k === "shortage_qty" ? "عجز" : k === "damaged_qty" ? "تالف" : "مرفوض"} value={l?.[k] ?? ""} onChange={(e) => set(i.id, k, e.target.value)} />
                    ))}
                  </div>
                  {l && (l.shortage_qty || l.damaged_qty || l.rejected_qty) && <input className="field" placeholder="السبب" value={l.reason} onChange={(e) => set(i.id, "reason", e.target.value)} />}
                </div>
              );
            })}
          </section>
        </>
      )}
      <button type="button" className="btn-primary" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          await apiPost(`/api/operations/stops/${stop.id}/delivery`, failed
            ? { result: "failed", failure_reason: failure }
            : { result: "delivered", receiver_name: receiver, customer_notes: notes || undefined, lines: Object.entries(lines).map(([order_item_id, l]) => ({ order_item_id, shortage_qty: l.shortage_qty || 0, damaged_qty: l.damaged_qty || 0, rejected_qty: l.rejected_qty || 0, reason: l.reason || undefined })) });
          toast.show("نتيجة التسليم اتسجلت", "success");
          onDone();
        } catch (err) { fail(toast, err); } finally { setBusy(false); }
      }}>سجّل النتيجة</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

type Ex = { id: string; type: string; status: string; description: string; productName: string | null; quantity: string | null; ownerName: string | null; resolution: string | null; resolvedBy: string | null; createdBy: string; createdAt: string; version: number; order: { orderNumber: string; customerName: string } | null };

function Exceptions() {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const [text, setText] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ["ops", "exceptions", status], queryFn: () => apiFetch<{ exceptions: Ex[] }>(`/api/operations/exceptions${status ? `?status=${status}` : ""}`) });
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={status} onChange={setStatus} items={[{ key: "open", label: "مفتوحة" }, { key: "resolved", label: "اتقفلت" }, { key: "", label: "الكل" }]} />
      {q.isLoading && <LoadingState />}
      {q.data && q.data.exceptions.length === 0 && <EmptyState icon="✅" title="مفيش استثناءات" />}
      <ul className="flex flex-col gap-2">
        {q.data?.exceptions.map((e) => (
          <li key={e.id} className="card p-3 flex flex-col gap-1">
            <div className="flex justify-between gap-2">
              <span className="font-extrabold">{EX_TYPE[e.type]}{e.productName ? ` · ${e.productName}` : ""}{e.quantity ? <> · <span dir="ltr">{fmtQty(e.quantity)}</span></> : null}</span>
              <span className={`text-xs font-extrabold ${e.status === "open" ? "text-united-warn" : "text-united-green"}`}>{e.status === "open" ? "مفتوح" : "اتقفل"}</span>
            </div>
            <p className="text-sm font-bold">{e.description}</p>
            <p className="text-xs font-bold text-united-muted">{e.order ? <><span dir="ltr">{e.order.orderNumber}</span> · {e.order.customerName} · </> : null}سجّله {e.createdBy}{e.ownerName ? ` · المسؤول ${e.ownerName}` : ""}{e.resolution ? ` · الحل: ${e.resolution} (${e.resolvedBy})` : ""}</p>
            {e.status === "open" && can("orders.approve") && (
              <div className="flex gap-2">
                <input className="field flex-1" placeholder="الحل" value={text[e.id] ?? ""} onChange={(ev) => setText({ ...text, [e.id]: ev.target.value })} />
                <button type="button" className="btn-secondary shrink-0" onClick={async () => {
                  try { await apiPost(`/api/operations/exceptions/${e.id}/resolve`, { resolution: text[e.id] ?? "", expected_version: e.version }); void qc.invalidateQueries({ queryKey: ["ops", "exceptions"] }); } catch (err) { fail(toast, err); }
                }}>اقفل</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fleet
// ---------------------------------------------------------------------------

function FleetView() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useFleet();
  const [v, setV] = useState({ code: "", plate: "", type: "truck", capacity_kg: "", refrigerated: false });
  const [d, setD] = useState({ name: "", phone: "" });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["ops", "fleet"] });
  const toggle = async (kind: "vehicles" | "drivers", row: { id: string; active: boolean; version: number } & Record<string, unknown>) => {
    try {
      const body = kind === "vehicles"
        ? { code: row.code, plate: row.plate, type: row.type, capacity_kg: row.capacityKg ? Number(row.capacityKg) : null, refrigerated: row.refrigerated, active: !row.active, expected_version: row.version }
        : { name: row.name, phone: row.phone, active: !row.active, expected_version: row.version };
      await apiPatch(`/api/operations/${kind}/${row.id}`, body);
      refresh();
    } catch (err) { fail(toast, err); }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-extrabold">العربيات</h3>
        <form className="grid grid-cols-2 gap-2" onSubmit={async (e) => {
          e.preventDefault();
          try { await apiPost("/api/operations/vehicles", { ...v, capacity_kg: v.capacity_kg ? Number(v.capacity_kg) : null }); setV({ code: "", plate: "", type: "truck", capacity_kg: "", refrigerated: false }); refresh(); } catch (err) { fail(toast, err); }
        }}>
          <input className="field" placeholder="الكود" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
          <input className="field" placeholder="رقم اللوحة" value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} />
          <select className="field" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}><option value="truck">نقل</option><option value="van">فان</option><option value="pickup">ربع نقل</option><option value="other">أخرى</option></select>
          <input className="field" dir="ltr" inputMode="decimal" placeholder="السعة (كجم)" value={v.capacity_kg} onChange={(e) => setV({ ...v, capacity_kg: e.target.value })} />
          <label className="flex items-center gap-2 font-bold text-sm"><input type="checkbox" checked={v.refrigerated} onChange={(e) => setV({ ...v, refrigerated: e.target.checked })} /> مبردة</label>
          <button className="btn-secondary">+ عربية</button>
        </form>
        <ul className="text-sm font-bold divide-y divide-united-dark/5">
          {q.data?.vehicles.map((x) => (
            <li key={x.id} className={`py-1 flex justify-between ${x.active ? "" : "text-united-muted line-through"}`}>
              <span>{x.code} · <span dir="ltr">{x.plate}</span>{x.refrigerated ? " ❄️" : ""}{x.capacityKg ? ` · ${Number(x.capacityKg)} كجم` : ""}</span>
              <button type="button" className="text-xs underline" onClick={() => toggle("vehicles", x)}>{x.active ? "إيقاف" : "تفعيل"}</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-extrabold">السواقين</h3>
        <form className="grid grid-cols-2 gap-2" onSubmit={async (e) => {
          e.preventDefault();
          try { await apiPost("/api/operations/drivers", { name: d.name, phone: d.phone || null }); setD({ name: "", phone: "" }); refresh(); } catch (err) { fail(toast, err); }
        }}>
          <input className="field" placeholder="الاسم" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <input className="field" dir="ltr" placeholder="التليفون" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
          <button className="btn-secondary col-span-2">+ سواق</button>
        </form>
        <ul className="text-sm font-bold divide-y divide-united-dark/5">
          {q.data?.drivers.map((x) => (
            <li key={x.id} className={`py-1 flex justify-between ${x.active ? "" : "text-united-muted line-through"}`}>
              <span>{x.name}{x.phone ? <> · <span dir="ltr">{x.phone}</span></> : null}</span>
              <button type="button" className="text-xs underline" onClick={() => toggle("drivers", x)}>{x.active ? "إيقاف" : "تفعيل"}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
