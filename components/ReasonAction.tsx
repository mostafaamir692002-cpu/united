"use client";

import { useState } from "react";

export function ReasonAction({
  label,
  confirmLabel = "تأكيد",
  className,
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  className?: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={className ?? "px-4 py-2 rounded-xl bg-united-dark/10 font-bold text-sm"}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-united-dark/5 rounded-xl p-3">
      <input
        autoFocus
        placeholder="السبب..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="field"
      />
      <div className="flex gap-2">
        <button
          disabled={!reason.trim() || busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onConfirm(reason);
              setOpen(false);
              setReason("");
            } finally {
              setBusy(false);
            }
          }}
          className="btn-primary flex-1"
        >
          {confirmLabel}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary">
          إلغاء
        </button>
      </div>
    </div>
  );
}
