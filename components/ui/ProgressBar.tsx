export function ProgressBar({
  label,
  done,
  total,
  tone = "green",
}: {
  label: string;
  done: number;
  total: number;
  tone?: "green" | "orange";
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-bold mb-1">
        <span className="text-united-dark">{label}</span>
        {/* dir="ltr" stops the browser's bidi algorithm from visually swapping the two
            numbers around the "/" inside this RTL page — without it "2 / 3" can render
            as "3 / 2" even though the DOM/accessibility order is correct. */}
        <span dir="ltr" className={complete ? "text-united-green" : "text-united-muted"}>
          {done} / {total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-united-dark/10 overflow-hidden">
        <div
          className={`h-full transition-all ${
            complete ? "bg-united-green" : tone === "orange" ? "bg-united-warn" : "bg-united-green/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
