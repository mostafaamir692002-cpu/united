import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "UNITED — نظام التجهيز والتحميل",
  description: "UNITED Fruits & Vegetables — Production & Dispatch System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-arabic bg-united-bg text-united-dark">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
