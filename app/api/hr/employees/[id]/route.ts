import { saveEmployee } from "@/lib/hr/service";
import { postHandler } from "@/lib/route-handlers";

export const PATCH = postHandler("hr.employees.manage", async (body, actor, params) => ({ employee: await saveEmployee(params.id, body, actor) }), () => 200);
