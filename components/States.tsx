export function LoadingState({ label = "بتحمّل..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-united-dark/50 gap-2">
      <div className="w-8 h-8 border-4 border-united-green/30 border-t-united-green rounded-full animate-spin" />
      <span className="font-bold">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "👍", title }: { icon?: string; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <span className="text-4xl">{icon}</span>
      <p className="text-united-dark/50 text-lg font-bold">{title}</p>
    </div>
  );
}

export function ErrorState({
  message = "حصل خطأ في الاتصال",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <span className="text-4xl">⚠️</span>
      <p className="text-united-danger font-bold text-lg">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-dark text-sm px-5">
          حاول تاني
        </button>
      )}
    </div>
  );
}
