import { useLocale } from "@/lib/locale";
import { SkeletonLine } from "@/components/Skeleton";

/** Keeps the order page's shape while it loads, so the header, progress and item rows
 * appear in place rather than the whole screen being replaced by a spinner. */
export function OrderDetailSkeleton() {
  const { t } = useLocale();
  return (
    <div className="p-4 max-w-2xl mx-auto pb-32" aria-busy="true" aria-label={t("orders.skeleton_loading")}>
      <SkeletonLine className="h-5 w-20 mb-3" />
      <div className="card p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <SkeletonLine className="h-8 w-1/2" />
          <SkeletonLine className="h-7 w-28 rounded-full" />
        </div>
        <SkeletonLine className="h-4 w-2/3 mb-4" />
        <div className="grid grid-cols-3 gap-2 mb-4">
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14" />
        </div>
        <SkeletonLine className="h-2 w-full mb-2" />
        <SkeletonLine className="h-2 w-full" />
      </div>
      <div className="flex flex-col gap-3 mt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-4">
            <SkeletonLine className="h-6 w-1/3 mb-3" />
            <div className="grid grid-cols-4 gap-2">
              <SkeletonLine className="h-12" />
              <SkeletonLine className="h-12" />
              <SkeletonLine className="h-12" />
              <SkeletonLine className="h-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
