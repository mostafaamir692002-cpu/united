"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn-primary mt-6 print:hidden" onClick={() => window.print()}>
      طباعة
    </button>
  );
}
