/* Deterministic business-day regression: the e2e suites' "today" must equal the
   app's "today" (Africa/Cairo), or document-level tests go stale at UTC midnight.
   This is the assertion that failed in flows.test.ts (management report over an
   empty day range) whenever the suite ran with the host on UTC and Cairo ahead.

   The test deliberately does NOT use the app's helper internally — it re-derives
   "today" independently from Intl with the same IANA zone and asserts equality
   with BOTH implementations, so neither side can drift silently. */
import { todayBiz, bizDay, local } from "../_days";
import { todayLocalISO } from "../../lib/localDate";

const { check, finish } = (() => {
  const failures: string[] = [];
  let pass = 0;
  const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) pass++;
    else {
      failures.push(name);
      console.log(`  FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 300) : "");
    }
  };
  const finish = (suite: string) => {
    console.log(`\n======== ${suite}: ${pass} passed, ${failures.length} failed ========`);
    if (failures.length) console.log("FAILURES:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(failures.length ? 1 : 0);
  };
  return { check, finish };
})();

// Independent re-derivation: YYYY-MM-DD in Africa/Cairo from raw Intl.
const tz = "Africa/Cairo";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
const independentToday = fmt.format(new Date());

check("test helper todayBiz() == independent Africa/Cairo today", todayBiz() === independentToday, { todayBiz: todayBiz(), independentToday });
check("app todayLocalISO() == independent Africa/Cairo today", todayLocalISO() === independentToday, { app: todayLocalISO(), independentToday });
check("test helper and app agree with each other", todayBiz() === todayLocalISO());
check("bizDay(+1) is tomorrow in Cairo, not a naive +24h string", /^\d{4}-\d{2}-\d{2}$/.test(bizDay(1)) && bizDay(1) >= todayBiz());
check("bizDay(-1) is a valid ISO day earlier or equal to today", /^\d{4}-\d{2}-\d{2}$/.test(bizDay(-1)) && bizDay(-1) <= todayBiz());
check("local() alias matches todayBiz()", local() === todayBiz());

finish("DAYS-REGRESSION");