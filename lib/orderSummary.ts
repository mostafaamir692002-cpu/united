import type { OrderDTO, OrderItemDTO } from "@/lib/client-types";
import type { OrderStatus } from "@/lib/types";
import { qty } from "@/lib/format";

/**
 * One place that answers, for any order: what stage is it at, how much is actually
 * done, how much is left, and what needs to happen next.
 *
 * Every board was computing pieces of this inline and disagreeing about the details —
 * one counted finished items, another counted quantities, none of them said what was
 * remaining. Operators were left subtracting numbers in their heads.
 */

export type StageKey = "prepare" | "load" | "done" | "cancelled";

/** Which physical activity the order is in right now, regardless of status naming. */
export function stageOf(status: OrderStatus): StageKey {
  if (status === "cancelled") return "cancelled";
  if (status === "dispatched") return "done";
  if (status === "loading" || status === "loaded" || status === "ready_for_loading") return "load";
  return "prepare";
}

/** What the status MEANS operationally — not a renamed database value. */
export const STATUS_MEANING: Record<OrderStatus, string> = {
  new: "وصل ولسه محدش بدأ فيه",
  preparing: "بيتجهز دلوقتي في الصالة",
  ready_for_loading: "خلص تجهيز ومستني التحميل",
  loading: "بيتحمّل على العربية دلوقتي",
  loaded: "اتحمّل كله ومستني تأكيد الخروج",
  dispatched: "خرج مع العربية",
  cancelled: "اتلغى",
};

export type QuantityRoll = {
  required: number;
  prepared: number;
  loaded: number;
  /** Still to prepare / still to load, in the unit of the order's items. */
  remainingToPrepare: number;
  remainingToLoad: number;
  itemsTotal: number;
  itemsPrepared: number;
  itemsLoaded: number;
  /** True when every unit is a KG-style weight, so one total is meaningful. */
  singleUnit: string | null;
};

export function rollUpQuantities(items: OrderItemDTO[]): QuantityRoll {
  const units = new Set(items.map((i) => i.unit));
  let required = 0, prepared = 0, loaded = 0, remainingToPrepare = 0, remainingToLoad = 0;
  let itemsPrepared = 0, itemsLoaded = 0;

  for (const i of items) {
    required += i.requiredQuantity;
    prepared += i.preparedQuantity ?? 0;
    loaded += i.loadedQuantity ?? 0;
    if (i.preparationStatus === "done") itemsPrepared++;
    else remainingToPrepare += Math.max(0, i.requiredQuantity - (i.preparedQuantity ?? 0));
    if (i.loadingStatus === "done") itemsLoaded++;
    else remainingToLoad += Math.max(0, (i.preparedQuantity ?? i.requiredQuantity) - (i.loadedQuantity ?? 0));
  }

  return {
    required, prepared, loaded,
    remainingToPrepare, remainingToLoad,
    itemsTotal: items.length, itemsPrepared, itemsLoaded,
    singleUnit: units.size === 1 ? [...units][0] : null,
  };
}

/** Per-item shortfall against what was asked for — the number nobody should compute by hand. */
export function itemShortfall(item: OrderItemDTO, stage: StageKey) {
  const actual = stage === "load" ? item.loadedQuantity : item.preparedQuantity;
  if (actual === null || actual === undefined) return null;
  const diff = Math.round((item.requiredQuantity - actual) * 1000) / 1000;
  return diff > 0 ? diff : null;
}

export type NextAction = {
  /** Short imperative for the card: "ابدأ التجهيز". */
  label: string;
  /** Who it is waiting on, in plain words. */
  owner: string;
  tone: "action" | "waiting" | "blocked" | "done";
};

/**
 * "What needs to happen NOW" — the question every board exists to answer, and the one
 * the UI previously left the operator to infer from a status badge.
 */
export function nextAction(order: OrderDTO): NextAction {
  if (order.status === "cancelled") return { label: "اتلغى", owner: "—", tone: "done" };
  if (order.status === "dispatched") return { label: "خلص وخرج", owner: "—", tone: "done" };
  if (order.needsReview) {
    return { label: "محتاج اعتماد المشرف", owner: "المشرف", tone: "blocked" };
  }
  const roll = rollUpQuantities(order.items);
  switch (order.status) {
    case "new":
      return { label: "ابدأ التجهيز", owner: "التجهيز", tone: "action" };
    case "preparing":
      return roll.itemsPrepared < roll.itemsTotal
        ? { label: `جهّز باقي ${roll.itemsTotal - roll.itemsPrepared} صنف`, owner: "التجهيز", tone: "action" }
        : { label: "أكّد إن التجهيز خلص", owner: "التجهيز", tone: "action" };
    case "ready_for_loading":
      return { label: "ابدأ التحميل", owner: "التحميل", tone: "action" };
    case "loading":
      return roll.itemsLoaded < roll.itemsTotal
        ? { label: `حمّل باقي ${roll.itemsTotal - roll.itemsLoaded} صنف`, owner: "التحميل", tone: "action" }
        : { label: "أكّد إن التحميل خلص", owner: "التحميل", tone: "action" };
    case "loaded":
      return { label: "أكّد خروج العربية", owner: "التحميل", tone: "action" };
    default:
      return { label: "—", owner: "—", tone: "waiting" };
  }
}

/** One-line shortage summary for a card: "ناقص ٣ كجم في صنفين". */
export function shortageSummary(order: OrderDTO): string | null {
  const stage = stageOf(order.status);
  if (stage === "cancelled") return null;
  const shorts = order.items
    .map((i) => ({ item: i, missing: itemShortfall(i, stage === "done" ? "load" : stage) }))
    .filter((x): x is { item: OrderItemDTO; missing: number } => x.missing !== null);
  if (shorts.length === 0) return null;
  const units = new Set(shorts.map((s) => s.item.unit));
  const total = shorts.reduce((s, x) => s + x.missing, 0);
  const amount = units.size === 1 ? `${qty(total)} ${[...units][0]}` : `${shorts.length} صنف`;
  return shorts.length === 1
    ? `ناقص ${qty(shorts[0].missing)} ${shorts[0].item.unit} — ${shorts[0].item.productName}`
    : `ناقص ${amount} في ${shorts.length} أصناف`;
}
