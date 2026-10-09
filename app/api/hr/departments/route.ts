import { saveDepartment } from "@/lib/hr/service";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("hr.employees.manage", async (body, actor) => ({ department: await saveDepartment(body, actor) }));
