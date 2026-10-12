"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderItemDTO } from "@/lib/client-types";
import { QuantityInput } from "@/components/QuantityInput";
import { qty as qtyLabel } from "@/lib/format";

type Mode = "display" | "prepare" | "load";

/** Parse a rejection reason from notes, if present. */
function parseRejection(notes: string | null): string | null {
  if (!notes) return null;
  const m = /^\[رفض:\s*(.+?)\s*\]/.exec(notes);
  return m ? m[1] : null;
}

export function ItemRow({
  item,
  mode,
  onConfirm,
  busy,
  supervisorEdit,
  onReject,
}: {
  item: OrderItemDTO;
  mode: Mode;
  onConfirm?: (quantity: number) => Promise<void>;
  busy?: boolean;
  supervisorEdit?: { onSave: (qty: number, reason: string) => Promise<void> };
  onReject?: (correctQuantity: number, reason: string) => Promise<void>;
}) {
  const startValue =
    mode === "load"
      ? item.loadedQuantity ?? item.preparedQuantity ?? item.requiredQuantity
      : item.preparedQuantity ?? item.requiredQuantity;
  const [qty, setQty] = useState(startValue);

  // The input was seeded once and then never looked at the item again, so after a
  // confirm — or after another tablet changed the same line — it kept showing a value
  // the server no longer held, and the next confirm would send it back. Re-seed when
  // the server's own numbers change, but never while the operator is mid-entry
  // (touched), so their typing is never yanked out from under them.
  const [touched, setTouched] = useState(false);
  const lastVersion = useRef(item.version);
  useEffect(() => {
    // item.version changes exactly when the server accepted a write to this line —
    // by this operator or another one. That is the moment the local draft is stale,
    // so re-seed from the server and let the field track it again.
    if (lastVersion.current !== item.version) {
      lastVersion.current = item.version;
      setQty(startValue);
      setTouched(false);
    }
  }, [item.version, startValue]);
  const [editingRequired, setEditingRequired] = useState(false);
  const [reqQty, setReqQty] = useState(String(item.requiredQuantity));
  const [reqReason, setReqReason] = useState("");
  const [outlierConfirmed, setOutlierConfirmed] = useState(false);
  const [rejectQty, setRejectQty] = useState(String(item.requiredQuantity));
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Detect rejection: item was done/prepared with a quantity, now reset to pending
  const rejectionReason = parseRejection(item.notes);
  const wasRejected = rejectionReason !== null && item.preparationStatus === "pending" && item.preparedQuantity != null;

  // A typo (50 instead of 5, or vice versa) is easy to make on a tablet and hard to
  // notice at a glance — catch anything wildly off from what was required and make
  // the operator tap twice instead of silently recording it. This is a UI-only nudge
  // (separate from the server's shortage/review threshold) and never blocks a
  // deliberate entry, just asks "are you sure" once.
  const outlierVariance =
    item.requiredQuantity > 0 ? Math.abs(qty - item.requiredQuantity) / item.requiredQuantity : 0;
  const isOutlier = outlierVariance > 0.2;

  function handleQtyChange(next: number) {
    setQty(next);
    setTouched(true);
    setOutlierConfirmed(false);
  }

  const done = mode === "load" ? item.loadingStatus === "done" : item.preparationStatus === "done";
  // What is still owed at THIS stage. Loading is measured against what was actually
  // prepared, not the original ask — you cannot load what was never picked.
  const stageTarget = mode === "load" ? item.preparedQuantity ?? item.requiredQuantity : item.requiredQuantity;
  const stageActual = mode === "load" ? item.loadedQuantity : item.preparedQuantity;
  const remaining = done ? 0 : Math.max(0, Math.round((stageTarget - (stageActual ?? 0)) * 1000) / 1000);
  const short =
    mode === "prepare"
      ? item.preparedQuantity != null && item.preparedQuantity < item.requiredQuantity
      : mode === "load"
      ? item.loadedQuantity != null && item.loadedQuantity < item.requiredQuantity
      : false;
  const mismatch =
    mode === "load" &&
    item.loadedQuantity != null &&
    item.preparedQuantity != null &&
    item.loadedQuantity !== item.preparedQuantity &&
    item.loadedQuantity >= item.requiredQuantity;

  return (
    <div className={`card p-4 sm:p-5 border-2 ${wasRejected ? "!border-united-danger" : short ? "!border-united-danger/30" : "!border-united-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg sm:text-xl font-extrabold text-united-dark">{item.productName}</span>
        {done && (
          <span className="w-8 h-8 rounded-full bg-united-green text-white flex items-center justify-center text-lg">
            ✓
          </span>
        )}
        {wasRejected && (
          <span className="text-sm font-bold text-united-danger bg-united-danger/10 px-2 py-1 rounded-lg">
            🚫 مرفوض
          </span>
        )}
      </div>

      {/* Rejection banner */}
      {wasRejected && rejectionReason && (
        <div className="bg-united-danger/5 border border-united-danger/20 rounded-lg p-3 mb-3">
          <p className="text-sm font-bold text-united-danger">
            🚫 رفض المشرف: {rejectionReason}
          </p>
          <p className="text-xs text-united-muted mt-1">
            جهز {qtyLabel(item.preparedQuantity)} {item.unit} — المطلوب الآن {qtyLabel(item.requiredQuantity)} {item.unit}
          </p>
        </div>
      )}

      {/* Required / prepared / loaded / remaining — every figure carries its unit, and
          "remaining" is shown rather than left for the operator to subtract. */}
      <div className="grid grid-cols-4 gap-2 text-center mb-3">
        <Figure label="المطلوب" value={qtyLabel(item.requiredQuantity)} unit={item.unit} />
        <Figure
          label="اتجهز"
          value={qtyLabel(item.preparedQuantity)}
          unit={item.unit}
          tone={item.preparationStatus === "done" ? "done" : "pending"}
        />
        <Figure
          label="اتحمل"
          value={qtyLabel(item.loadedQuantity)}
          unit={item.unit}
          tone={item.loadingStatus === "done" ? "done" : "pending"}
        />
        <Figure
          label={mode === "load" ? "فاضل تحميل" : "فاضل تجهيز"}
          value={qtyLabel(remaining)}
          unit={item.unit}
          tone={remaining > 0 ? "short" : "done"}
        />
      </div>

      {(mode === "prepare" || mode === "load") && !done && (
        <div className="border-t border-united-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <QuantityInput value={qty} onChange={handleQtyChange} disabled={busy} />
            <button
              disabled={busy}
              onClick={() => {
                if (isOutlier && !outlierConfirmed) {
                  setOutlierConfirmed(true);
                  return;
                }
                onConfirm?.(qty);
              }}
              className={`px-6 text-lg btn-primary ${isOutlier && !outlierConfirmed ? "!bg-united-warn" : ""}`}
            >
              {busy
                ? "بيتسجل…"
                : isOutlier && !outlierConfirmed
                ? "⚠️ متأكد من الكمية؟"
                : mode === "prepare"
                ? "✓ اتجهز"
                : "✓ اتحمل"}
            </button>
          </div>
          {isOutlier && (
            <p className="text-united-warn font-bold text-sm mt-2">
              الكمية دي بعيدة عن المطلوب (<span dir="ltr">{qtyLabel(item.requiredQuantity)} {item.unit}</span>) —{" "}
              {outlierConfirmed ? "دوس التأكيد تاني عشان تتسجل." : "اضغط تاني لو متأكد."}
            </p>
          )}
        </div>
      )}

      {short && (
        <p className="text-united-danger font-bold mt-2">
          ⚠️ ناقص{" "}
          <span dir="ltr">
            {qtyLabel(item.requiredQuantity - (mode === "load" ? item.loadedQuantity! : item.preparedQuantity!))} {item.unit}
          </span>{" "}
          عن المطلوب
        </p>
      )}
      {!short && mismatch && (
        <p className="text-united-warn font-bold mt-2">⚠️ الكمية مختلفة عن اللي اتجهزت</p>
      )}

      {/* Supervisor actions: edit required qty + reject preparation */}
      {supervisorEdit && (
        <div className="border-t border-united-border pt-3 mt-3 space-y-3">
          {/* Edit required quantity */}
          {!editingRequired ? (
            <button
              onClick={() => setEditingRequired(true)}
              className="text-sm font-bold text-united-muted underline block"
            >
              عدّل الكمية المطلوبة
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={reqQty}
                  onChange={(e) => setReqQty(e.target.value)}
                  className="field w-24 text-center"
                />
                <input
                  placeholder="السبب..."
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  className="field flex-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!reqReason.trim() || !reqQty}
                  onClick={async () => {
                    await supervisorEdit.onSave(Number(reqQty), reqReason);
                    setEditingRequired(false);
                    setReqReason("");
                  }}
                  className="btn-primary flex-1"
                >
                  حفظ
                </button>
                <button onClick={() => setEditingRequired(false)} className="btn-secondary">
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Reject preparation (only when the item has been prepared/done) */}
          {(item.preparationStatus === "done" || item.preparedQuantity != null) && onReject && (
            <>
              {!showRejectForm ? (
                <button
                  onClick={() => {
                    setRejectQty(String(item.requiredQuantity));
                    setRejectReason("");
                    setShowRejectForm(true);
                  }}
                  className="text-sm font-bold text-united-danger underline block"
                >
                  🚫 رفض التجهيز
                </button>
              ) : (
                <div className="flex flex-col gap-2 bg-united-danger/5 p-3 rounded-lg border border-united-danger/20">
                  <p className="text-sm font-bold text-united-danger">رفض التجهيز</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-united-muted">الكمية الصحيحة</label>
                      <input
                        type="number"
                        value={rejectQty}
                        onChange={(e) => setRejectQty(e.target.value)}
                        className="field w-full text-center"
                      />
                    </div>
                  </div>
                  <input
                    placeholder="سبب الرفض..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="field w-full"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!rejectReason.trim() || !rejectQty || busy}
                      onClick={async () => {
                        await onReject(Number(rejectQty), rejectReason);
                        setShowRejectForm(false);
                        setRejectReason("");
                      }}
                      className="btn-danger flex-1"
                    >
                      {busy ? "جاري..." : "تأكيد الرفض"}
                    </button>
                    <button onClick={() => setShowRejectForm(false)} className="btn-secondary">
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** One labelled figure in the item's quantity grid. dir="ltr" on the number keeps the
 * value and its unit from being visually reordered inside the RTL page. */
function Figure({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "neutral" | "done" | "pending" | "short";
}) {
  const toneClass = {
    neutral: "text-united-dark",
    done: "text-united-green",
    pending: "text-united-dark/40",
    short: "text-united-danger",
  }[tone];
  return (
    <div>
      <div className="text-[11px] text-united-muted mb-0.5">{label}</div>
      <div dir="ltr" className={`font-extrabold text-lg sm:text-xl ${toneClass}`}>
        {value}
        {value !== "—" && <span className="text-[10px] font-bold text-united-dark/40"> {unit}</span>}
      </div>
    </div>
  );
}