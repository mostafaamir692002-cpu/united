"use client";

export function QuantityInput({
  value,
  onChange,
  disabled,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="نقّص الكمية"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - step))}
        className="tap-target w-14 rounded-xl bg-united-dark/10 text-2xl font-extrabold disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        aria-label="الكمية"
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
        className="tap-target w-24 text-center text-2xl font-extrabold border-2 border-united-dark/10 rounded-xl focus:border-united-green outline-none disabled:opacity-50"
      />
      <button
        type="button"
        aria-label="زوّد الكمية"
        disabled={disabled}
        onClick={() => onChange(value + step)}
        className="tap-target w-14 rounded-xl bg-united-green/20 text-united-dark text-2xl font-extrabold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
