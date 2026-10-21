"use client";

/** Simple page-navigation widget: prev / next with page count. */
export function Pagination({
  page, pageSize, total, onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 text-sm font-bold">
      <span className="text-united-muted">
        الصفحة {page} من {totalPages} ({total} سجل)
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          className="btn-ghost btn-sm disabled:opacity-30"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ‹ السابق
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm disabled:opacity-30"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          التالي ›
        </button>
      </div>
    </div>
  );
}