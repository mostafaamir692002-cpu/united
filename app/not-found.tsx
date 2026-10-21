import { headers } from "next/headers";
import Link from "next/link";

/** Custom 404 page — friendlier than the browser's default "Not Found". */
export default async function NotFound() {
  const h = await headers();
  const path = h.get("x-request-path") ?? "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md flex flex-col gap-4 items-center text-center">
        <span className="text-6xl">🤔</span>
        <h1 className="text-2xl font-extrabold text-united-dark">هذه الصفحة مش موجودة</h1>
        {path && (
          <p className="text-sm font-bold text-united-muted">
            <code className="text-xs">{path}</code>
          </p>
        )}
        <p className="text-sm text-united-muted">يمكن الرابط غلط أو مش ليك الصلاحية. ارجع للصفحة الرئيسية وابدأ من هناك.</p>
        <Link href="/" className="btn-primary text-lg px-8">الرئيسية</Link>
      </div>
    </main>
  );
}