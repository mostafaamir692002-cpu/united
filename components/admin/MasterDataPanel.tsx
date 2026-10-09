"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import {
  STORAGE_LOCATION_TYPES,
  STORAGE_LOCATION_TYPE_LABEL,
  UOM_CATEGORIES,
  UOM_CATEGORY_LABEL,
  type StorageLocationType,
  type UomCategory,
} from "@/lib/core/reference-data";
import type {
  BranchDTO,
  CompanyDTO,
  CurrencyDTO,
  MasterDataDTO,
  StorageLocationDTO,
  UomDTO,
  WarehouseDTO,
} from "@/lib/master-client-types";

/**
 * Organisation master data: the company, its branches, warehouses and storage
 * locations, plus units of measure and currencies. Codes are fixed once created (they
 * end up on documents); everything else is editable, versioned and audited server-side.
 * Nothing is deleted — rows are deactivated.
 */

type Entity = "companies" | "branches" | "warehouses" | "locations" | "uoms" | "currencies";

type Field = {
  key: string;
  label: string;
  kind?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  ltr?: boolean;
  /** Shown on create only (codes, parents, categories — fixed afterwards). */
  createOnly?: boolean;
  required?: boolean;
  hint?: string;
};

export function MasterDataPanel({ canManage }: { canManage: boolean }) {
  const q = useQuery({
    queryKey: ["admin", "master"],
    queryFn: () => apiFetch<MasterDataDTO>("/api/admin/master"),
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const data = q.data!;

  return (
    <div className="flex flex-col gap-4">
      {data.companies.map((c) => (
        <CompanySection key={c.id} company={c} currencies={data.currencies} canManage={canManage} />
      ))}
      <UomSection uoms={data.uoms} canManage={canManage} />
      <CurrencySection currencies={data.currencies} canManage={canManage} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Organisation tree
// ---------------------------------------------------------------------------

function CompanySection({ company, currencies, canManage }: { company: CompanyDTO; currencies: CurrencyDTO[]; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const currencyOptions = currencies.filter((c) => c.active && c.code === "EGP").map((c) => ({ value: c.code, label: `${c.code} · ${c.nameAr ?? c.name}` }));

  return (
    <section className="card p-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold text-united-dark">
            {company.nameAr ?? company.legalName} <Code>{company.code}</Code>
          </h2>
          <Facts
            items={[
              ["الاسم القانوني", company.legalName],
              ["التسجيل الضريبي", company.taxRegistrationNumber],
              ["السجل التجاري", company.commercialRegistration],
              ["العملة الأساسية", company.baseCurrencyCode],
            ]}
          />
        </div>
        <div className="flex gap-2 items-center">
          <ActiveBadge active={company.active} />
          {canManage && (
            <button type="button" className="btn-secondary text-sm" onClick={() => setEditing((x) => !x)}>
              تعديل
            </button>
          )}
        </div>
      </header>
      {editing && (
        <EntityForm
          entity="companies"
          row={company}
          fields={[
            { key: "legal_name", label: "الاسم القانوني", required: true },
            { key: "name_ar", label: "الاسم بالعربي" },
            { key: "trade_name", label: "الاسم التجاري" },
            { key: "tax_registration_number", label: "رقم التسجيل الضريبي", ltr: true },
            { key: "commercial_registration", label: "رقم السجل التجاري", ltr: true },
            { key: "base_currency_code", label: "العملة الأساسية", kind: "select", options: currencyOptions },
            { key: "phone", label: "التليفون", ltr: true },
            { key: "email", label: "الإيميل", ltr: true },
            { key: "address", label: "العنوان" },
          ]}
          initial={{
            legal_name: company.legalName,
            name_ar: company.nameAr,
            trade_name: company.tradeName,
            tax_registration_number: company.taxRegistrationNumber,
            commercial_registration: company.commercialRegistration,
            base_currency_code: company.baseCurrencyCode,
            phone: company.phone,
            email: company.email,
            address: company.address,
          }}
          onDone={() => setEditing(false)}
        />
      )}

      <div className="mt-4 flex flex-col gap-3">
        {company.branches.length === 0 && <EmptyState icon="🏢" title="مفيش فروع" />}
        {company.branches.map((b) => (
          <BranchBlock key={b.id} branch={b} canManage={canManage} />
        ))}
      </div>
      {canManage && (
        <div className="mt-3">
          {adding ? (
            <EntityForm
              entity="branches"
              fields={[
                { key: "code", label: "كود الفرع", ltr: true, createOnly: true, required: true, hint: "مثال: ALEX" },
                { key: "name", label: "الاسم", required: true },
                { key: "name_ar", label: "الاسم بالعربي" },
                { key: "address", label: "العنوان" },
                { key: "phone", label: "التليفون", ltr: true },
              ]}
              fixed={{ company_id: company.id }}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button type="button" className="btn-secondary text-sm" onClick={() => setAdding(true)} disabled={!company.active}>
              + فرع
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function BranchBlock({ branch, canManage }: { branch: BranchDTO; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  return (
    <div className="rounded-xl border border-united-border p-3">
      <RowHeader
        title={branch.nameAr ?? branch.name}
        code={branch.code}
        active={branch.active}
        canManage={canManage}
        onEdit={() => setEditing((x) => !x)}
        toggle={{ entity: "branches", id: branch.id, active: branch.active, version: branch.version }}
      />
      {editing && (
        <EntityForm
          entity="branches"
          row={branch}
          fields={[
            { key: "name", label: "الاسم", required: true },
            { key: "name_ar", label: "الاسم بالعربي" },
            { key: "address", label: "العنوان" },
            { key: "phone", label: "التليفون", ltr: true },
          ]}
          initial={{ name: branch.name, name_ar: branch.nameAr, address: branch.address, phone: branch.phone }}
          onDone={() => setEditing(false)}
        />
      )}
      <div className="mt-2 flex flex-col gap-2 ps-3 border-s-2 border-united-green/20">
        {branch.warehouses.map((w) => (
          <WarehouseBlock key={w.id} warehouse={w} canManage={canManage} />
        ))}
        {canManage &&
          (adding ? (
            <EntityForm
              entity="warehouses"
              fields={WAREHOUSE_FIELDS_CREATE}
              fixed={{ branch_id: branch.id }}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button type="button" className="btn-secondary text-sm self-start" onClick={() => setAdding(true)} disabled={!branch.active}>
              + مخزن
            </button>
          ))}
      </div>
    </div>
  );
}

const WAREHOUSE_FIELDS_CREATE: Field[] = [
  { key: "code", label: "كود المخزن", ltr: true, createOnly: true, required: true, hint: "مثال: WH-2" },
  { key: "name", label: "الاسم", required: true },
  { key: "name_ar", label: "الاسم بالعربي" },
  { key: "area_m2", label: "المساحة (م²)", kind: "number" },
  { key: "daily_capacity_kg", label: "الطاقة اليومية (كجم)", kind: "number" },
  { key: "address", label: "العنوان" },
];

function WarehouseBlock({ warehouse, canManage }: { warehouse: WarehouseDTO; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const roots = warehouse.locations.filter((l) => !l.parentId);

  return (
    <div className="rounded-xl bg-united-bg p-3">
      <RowHeader
        title={warehouse.nameAr ?? warehouse.name}
        code={warehouse.code}
        active={warehouse.active}
        canManage={canManage}
        onEdit={() => setEditing((x) => !x)}
        toggle={{ entity: "warehouses", id: warehouse.id, active: warehouse.active, version: warehouse.version }}
      />
      <Facts
        items={[
          ["المساحة", warehouse.areaM2 && `${fmt(warehouse.areaM2)} م²`],
          ["الطاقة اليومية", warehouse.dailyCapacityKg && `${fmtKg(warehouse.dailyCapacityKg)}`],
        ]}
      />
      {editing && (
        <EntityForm
          entity="warehouses"
          row={warehouse}
          fields={WAREHOUSE_FIELDS_CREATE.filter((f) => !f.createOnly)}
          initial={{
            name: warehouse.name,
            name_ar: warehouse.nameAr,
            area_m2: warehouse.areaM2,
            daily_capacity_kg: warehouse.dailyCapacityKg,
            address: warehouse.address,
          }}
          onDone={() => setEditing(false)}
        />
      )}
      <ul className="mt-2 flex flex-col gap-1.5">
        {roots.map((l) => (
          <LocationNode key={l.id} location={l} all={warehouse.locations} canManage={canManage} depth={0} />
        ))}
      </ul>
      {canManage && (
        <div className="mt-2">
          {adding ? (
            <EntityForm
              entity="locations"
              fields={locationFields(warehouse.locations, true)}
              fixed={{ warehouse_id: warehouse.id }}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button type="button" className="btn-secondary text-sm" onClick={() => setAdding(true)} disabled={!warehouse.active}>
              + مكان تخزين
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function locationFields(siblings: StorageLocationDTO[], creating: boolean, selfId?: string): Field[] {
  return [
    ...(creating ? [{ key: "code", label: "كود المكان", ltr: true, createOnly: true, required: true, hint: "مثال: COLD-3" } as Field] : []),
    { key: "name", label: "الاسم", required: true },
    { key: "name_ar", label: "الاسم بالعربي" },
    {
      key: "type",
      label: "النوع",
      kind: "select",
      required: true,
      options: STORAGE_LOCATION_TYPES.map((t) => ({ value: t, label: STORAGE_LOCATION_TYPE_LABEL[t] })),
    },
    {
      key: "parent_id",
      label: "جوه مكان",
      kind: "select",
      options: [
        { value: "", label: "— مكان رئيسي —" },
        ...siblings.filter((l) => l.active && l.id !== selfId).map((l) => ({ value: l.id, label: `${l.code} · ${l.nameAr ?? l.name}` })),
      ],
    },
    { key: "capacity_kg", label: "السعة (كجم)", kind: "number" },
    { key: "temp_min_c", label: "أقل حرارة (°م)", kind: "number" },
    { key: "temp_max_c", label: "أعلى حرارة (°م)", kind: "number" },
  ];
}

function LocationNode({ location, all, canManage, depth }: { location: StorageLocationDTO; all: StorageLocationDTO[]; canManage: boolean; depth: number }) {
  const [editing, setEditing] = useState(false);
  const children = all.filter((l) => l.parentId === location.id);
  // Spelled out rather than "2 ↔ 6": an arrow between numbers has no reliable
  // reading direction inside right-to-left text.
  const band =
    location.tempMinC != null && location.tempMaxC != null
      ? `من ${location.tempMinC} إلى ${location.tempMaxC} °م`
      : location.tempMinC != null
      ? `من ${location.tempMinC} °م`
      : location.tempMaxC != null
      ? `حتى ${location.tempMaxC} °م`
      : null;
  return (
    <li style={{ marginInlineStart: depth * 16 }}>
      <div className="rounded-lg bg-white border border-united-border px-3 py-2">
        <RowHeader
          title={location.nameAr ?? location.name}
          code={location.code}
          active={location.active}
          canManage={canManage}
          onEdit={() => setEditing((x) => !x)}
          toggle={{ entity: "locations", id: location.id, active: location.active, version: location.version }}
          small
        />
        <Facts
          items={[
            ["النوع", STORAGE_LOCATION_TYPE_LABEL[location.type as StorageLocationType] ?? location.type],
            ["السعة", location.capacityKg && fmtKg(location.capacityKg)],
            ["الحرارة", band],
          ]}
        />
        {editing && (
          <EntityForm
            entity="locations"
            row={location}
            fields={locationFields(all, false, location.id)}
            initial={{
              name: location.name,
              name_ar: location.nameAr,
              type: location.type,
              parent_id: location.parentId ?? "",
              capacity_kg: location.capacityKg,
              temp_min_c: location.tempMinC,
              temp_max_c: location.tempMaxC,
            }}
            onDone={() => setEditing(false)}
          />
        )}
      </div>
      {children.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {children.map((c) => (
            <LocationNode key={c.id} location={c} all={all} canManage={canManage} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Units & currencies
// ---------------------------------------------------------------------------

function UomSection({ uoms, canManage }: { uoms: UomDTO[]; canManage: boolean }) {
  const [adding, setAdding] = useState(false);
  const refByCategory = new Map(uoms.filter((u) => u.isReference).map((u) => [u.category, u.code]));
  return (
    <section className="card p-4">
      <h2 className="text-lg font-extrabold text-united-dark">وحدات القياس</h2>
      <p className="text-xs font-bold text-united-muted mb-3">
        وحدات الوزن والحجم والعدد بتتحول بمعامل ثابت. وحدات التعبئة (برنيكة، كرتونة…) تحويلها بيتحدد لكل صنف — مش هنا.
        الكود والنوع والمعامل مش بيتغيروا بعد الإنشاء.
      </p>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-united-muted text-xs">
              <th className="text-right p-2">الوحدة</th>
              <th className="text-right p-2">النوع</th>
              <th className="text-right p-2">التحويل</th>
              <th className="text-right p-2">خانات عشرية</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {UOM_CATEGORIES.flatMap((cat) => uoms.filter((u) => u.category === cat)).map((u) => (
              <UomRow key={u.id} uom={u} reference={refByCategory.get(u.category)} canManage={canManage} />
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <div className="mt-3">
          {adding ? (
            <EntityForm
              entity="uoms"
              fields={[
                { key: "code", label: "الكود", ltr: true, createOnly: true, required: true, hint: "مثال: SACK" },
                { key: "name", label: "الاسم", required: true },
                { key: "name_ar", label: "الاسم بالعربي" },
                {
                  key: "category",
                  label: "النوع",
                  kind: "select",
                  required: true,
                  createOnly: true,
                  options: UOM_CATEGORIES.map((c) => ({ value: c, label: UOM_CATEGORY_LABEL[c] })),
                },
                { key: "ratio_to_reference", label: "كام وحدة مرجعية (فاضي للتعبئة)", kind: "number", createOnly: true },
                { key: "precision", label: "خانات عشرية", kind: "number" },
              ]}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button type="button" className="btn-secondary text-sm" onClick={() => setAdding(true)}>
              + وحدة
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function UomRow({ uom, reference, canManage }: { uom: UomDTO; reference?: string; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className={`border-t border-united-border ${uom.active ? "" : "opacity-50"}`}>
        <td className="p-2">
          <span className="font-bold text-united-dark">{uom.nameAr ?? uom.name}</span> <Code>{uom.code}</Code>
          {uom.isReference && <span className="ms-1 text-[10px] font-extrabold text-united-green">مرجعية</span>}
        </td>
        <td className="p-2 font-bold text-united-muted">{UOM_CATEGORY_LABEL[uom.category as UomCategory] ?? uom.category}</td>
        <td className="p-2">
          {uom.ratioToReference && reference && !uom.isReference ? (
            <bdi dir="ltr" className="tabular-nums font-bold">
              {/* Latin digits and the stored string as-is: no script mixing inside an LTR
                  formula, and no float round-trip (0.45359237 stays exact). */}
              1 {uom.code} = {uom.ratioToReference} {reference}
            </bdi>
          ) : uom.category === "package" ? (
            <span className="text-xs font-bold text-united-muted">حسب الصنف</span>
          ) : (
            "—"
          )}
        </td>
        <td className="p-2 tabular-nums">{uom.precision}</td>
        <td className="p-2">
          {canManage && (
            <div className="flex gap-1 justify-end">
              <button type="button" className="btn-secondary !min-h-0 py-1.5 px-3 text-xs" onClick={() => setEditing((x) => !x)}>
                تعديل
              </button>
              {!uom.isReference && <ToggleActive entity="uoms" id={uom.id} active={uom.active} version={uom.version} />}
            </div>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5}>
            <EntityForm
              entity="uoms"
              row={uom}
              fields={[
                { key: "name", label: "الاسم", required: true },
                { key: "name_ar", label: "الاسم بالعربي" },
                { key: "precision", label: "خانات عشرية", kind: "number" },
              ]}
              initial={{ name: uom.name, name_ar: uom.nameAr, precision: String(uom.precision) }}
              onDone={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function CurrencySection({ currencies, canManage }: { currencies: CurrencyDTO[]; canManage: boolean }) {
  return (
    <section className="card p-4">
      <h2 className="text-lg font-extrabold text-united-dark mb-3">العملات</h2>
      <p className="text-xs font-bold text-united-muted mb-2">دفاتر النظام بالجنيه المصري فقط. العملات الأخرى المعروضة بيانات مرجعية قديمة ولا يمكن استخدامها في الحركات.</p>
      <ul className="flex flex-col divide-y divide-united-border">
        {currencies.map((c) => (
          <CurrencyRow key={c.code} currency={c} canManage={canManage && c.code === "EGP"} />
        ))}
      </ul>
    </section>
  );
}

function CurrencyRow({ currency, canManage }: { currency: CurrencyDTO; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="py-2.5">
      <RowHeader
        title={`${currency.nameAr ?? currency.name}${currency.symbol ? ` (${currency.symbol})` : ""}`}
        code={currency.code}
        active={currency.active}
        canManage={canManage}
        onEdit={() => setEditing((x) => !x)}
        toggle={{ entity: "currencies", id: currency.code, active: currency.active, version: currency.version }}
        small
      />
      {editing && (
        <EntityForm
          entity="currencies"
          row={{ id: currency.code, version: currency.version }}
          fields={[
            { key: "name", label: "الاسم", required: true },
            { key: "name_ar", label: "الاسم بالعربي" },
            { key: "symbol", label: "الرمز" },
            { key: "decimal_places", label: "خانات عشرية", kind: "number" },
          ]}
          initial={{ name: currency.name, name_ar: currency.nameAr, symbol: currency.symbol, decimal_places: String(currency.decimalPlaces) }}
          onDone={() => setEditing(false)}
        />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function RowHeader({
  title,
  code,
  active,
  canManage,
  onEdit,
  toggle,
  small,
}: {
  title: string;
  code: string;
  active: boolean;
  canManage: boolean;
  onEdit: () => void;
  toggle: { entity: Entity; id: string; active: boolean; version: number };
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className={`font-extrabold text-united-dark ${small ? "text-sm" : ""} ${active ? "" : "opacity-50"}`}>
        {title} <Code>{code}</Code>
      </span>
      <div className="flex gap-1 items-center">
        <ActiveBadge active={active} />
        {canManage && (
          <>
            <button type="button" className="btn-secondary !min-h-0 py-1.5 px-3 text-xs" onClick={onEdit}>
              تعديل
            </button>
            <ToggleActive {...toggle} />
          </>
        )}
      </div>
    </div>
  );
}

function ToggleActive({ entity, id, active, version }: { entity: Entity; id: string; active: boolean; version: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function flip() {
    if (busy) return;
    setBusy(true);
    try {
      await apiPatch(`/api/admin/master/${entity}/${encodeURIComponent(id)}`, { active: !active, expected_version: version });
      await qc.invalidateQueries({ queryKey: ["admin", "master"] });
      toast.show(active ? "اتوقف" : "اتفعّل", "success");
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={flip}
      disabled={busy}
      className={`!min-h-0 py-1.5 px-3 text-xs ${active ? "btn-danger" : "btn-secondary"}`}
    >
      {active ? "إيقاف" : "تفعيل"}
    </button>
  );
}

/**
 * One form for every entity: create when `row` is absent, edit otherwise. An edit
 * sends only the fields that actually changed, plus the version the editor saw.
 */
function EntityForm({
  entity,
  fields,
  row,
  initial = {},
  fixed = {},
  onDone,
}: {
  entity: Entity;
  fields: Field[];
  row?: { id: string; version: number };
  initial?: Record<string, string | number | null | undefined>;
  fixed?: Record<string, string>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const start = Object.fromEntries(fields.map((f) => [f.key, initial[f.key] == null ? "" : String(initial[f.key])]));
  const [values, setValues] = useState<Record<string, string>>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function encode(f: Field, raw: string): unknown {
    const v = raw.trim();
    if (f.kind === "number") {
      if (v === "") return null;
      return Number.isFinite(Number(v)) ? Number(v) : v; // let the server word the error
    }
    return v === "" ? (f.required ? "" : null) : v;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...fixed };
      for (const f of fields) {
        if (row && values[f.key] === start[f.key]) continue;
        const encoded = encode(f, values[f.key]);
        if (!row && encoded === null) continue;
        body[f.key] = encoded;
      }
      if (row) {
        if (Object.keys(body).length === 0) {
          onDone();
          return;
        }
        await apiPatch(`/api/admin/master/${entity}/${encodeURIComponent(row.id)}`, { ...body, expected_version: row.version });
      } else {
        await apiPost(`/api/admin/master/${entity}`, body);
      }
      await qc.invalidateQueries({ queryKey: ["admin", "master"] });
      toast.show(row ? "اتحفظ" : "اتضاف", "success");
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border-2 border-united-green/20 bg-white p-3 grid gap-2 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="text-xs font-bold text-united-muted">
            {f.label}
            {f.required && " *"}
            {f.hint && <span className="font-normal"> — {f.hint}</span>}
          </span>
          {f.kind === "select" ? (
            <select
              className="field"
              value={values[f.key]}
              onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
            >
              {!f.required && !f.options?.some((o) => o.value === "") && <option value="">—</option>}
              {f.required && values[f.key] === "" && <option value="">اختار…</option>}
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={`field ${f.kind === "number" ? "tabular-nums" : ""}`}
              dir={f.ltr || f.kind === "number" ? "ltr" : undefined}
              inputMode={f.kind === "number" ? "decimal" : undefined}
              value={values[f.key]}
              onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          )}
        </label>
      ))}
      {error && <p className="sm:col-span-2 text-sm font-bold text-united-danger">{error}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {row ? "حفظ" : "إضافة"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
        active ? "bg-united-green/10 text-united-green" : "bg-united-dark/5 text-united-muted"
      }`}
    >
      {active ? "نشط" : "موقوف"}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code dir="ltr" className="text-[11px] font-bold text-united-muted bg-united-dark/5 rounded px-1.5 py-0.5">
      {children}
    </code>
  );
}

function Facts({ items }: { items: [string, string | null | undefined | false][] }) {
  const shown = items.filter(([, v]) => v);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs font-bold text-united-muted">
      {shown.map(([k, v]) => (
        <span key={k}>
          {k}: <bdi className="text-united-dark">{v}</bdi>
        </span>
      ))}
    </div>
  );
}

const fmt = (v: string) => Number(v).toLocaleString("ar-EG", { maximumFractionDigits: 3 });
const fmtKg = (v: string) => {
  const n = Number(v);
  return n >= 1000 ? `${(n / 1000).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} طن` : `${fmt(v)} كجم`;
};
