"use client";

import { useState } from "react";

/** The truck-leaving confirmation — requires driver name, vehicle number, and crate
 * count before it will actually fire, since a dispatched order with a blank manifest
 * is useless. Mirrors the two-step reveal pattern used by ReasonAction. */
export function DispatchButton({
  busy,
  onConfirm,
}: {
  busy?: boolean;
  onConfirm: (info: { vehicle: string; driverName: string; crateCount: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState("");
  const [driverName, setDriverName] = useState("");
  const [crateCount, setCrateCount] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-dark w-full text-xl">
        العربية جاهزة للخروج 🚚
      </button>
    );
  }

  const canConfirm = vehicle.trim() && driverName.trim() && Number(crateCount) > 0;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <h2 className="font-extrabold text-united-dark">بيانات الخروج</h2>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-united-muted">اسم السواق</span>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="field" autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-united-muted">رقم/اسم العربية</span>
        <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-united-muted">عدد البرنيكة</span>
        <input
          type="number"
          inputMode="numeric"
          value={crateCount}
          onChange={(e) => setCrateCount(e.target.value)}
          className="field"
        />
      </label>
      <div className="flex gap-2">
        <button
          disabled={!canConfirm || busy}
          onClick={() => {
            if (busy) return;
            onConfirm({ vehicle: vehicle.trim(), driverName: driverName.trim(), crateCount: Number(crateCount) });
          }}
          className="btn-primary flex-1 text-lg"
        >
          تأكيد الخروج
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary px-5">
          إلغاء
        </button>
      </div>
    </div>
  );
}
