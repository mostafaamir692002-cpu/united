import { redirect } from "next/navigation";
import { resolveHomePath } from "@/lib/session-guard";

export default async function RootPage() {
  redirect(await resolveHomePath());
}
