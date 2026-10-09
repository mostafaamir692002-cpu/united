import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncPermissionCatalogue } from "../lib/authz-core";
import { CASH_ACCOUNTS, CHART_OF_ACCOUNTS, CURRENCIES, DEFAULT_ORG, TAX_RATES, UNITS_OF_MEASURE } from "../lib/core/reference-data";

/** Baseline reference + organisation rows — the same ones the
 * add_org_master_data migration inserts in production. Idempotent. */
async function seedReferenceData(prisma: PrismaClient) {
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: c.code }, update: {}, create: { ...c } });
  }
  for (const t of TAX_RATES) {
    await prisma.taxRate.upsert({ where: { code: t.code }, update: {}, create: { ...t } });
  }
  for (const u of UNITS_OF_MEASURE) {
    await prisma.unitOfMeasure.upsert({ where: { id: u.id }, update: {}, create: { ...u } });
  }
  const { company, branch, warehouse, locations } = DEFAULT_ORG;
  await prisma.company.upsert({ where: { id: company.id }, update: {}, create: { ...company } });
  await prisma.branch.upsert({ where: { id: branch.id }, update: {}, create: { ...branch } });
  await prisma.warehouse.upsert({ where: { id: warehouse.id }, update: {}, create: { ...warehouse } });
  for (const l of locations) {
    await prisma.storageLocation.upsert({ where: { id: l.id }, update: {}, create: { ...l } });
  }
  for (const a of CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({ where: { id: a.id }, update: {}, create: { ...a } });
  }
  for (const c of CASH_ACCOUNTS) {
    await prisma.cashAccount.upsert({ where: { id: c.id }, update: {}, create: { ...c } });
  }
}

/**
 * Demo / test fixtures. Writes demo users with a known password and demo orders —
 * never run this against a production database. `npm run db:seed` refuses a
 * Supabase-hosted DATABASE_URL unless ALLOW_DEMO_SEED=1 is set deliberately.
 */

async function upsertUser(prisma: PrismaClient, username: string, name: string, role: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { username },
    update: { name, role, passwordHash, active: true },
    create: { username, name, role, passwordHash },
  });
}

export async function runSeed(prisma: PrismaClient) {
  // Permissions first — the users seeded below resolve their access through it.
  await syncPermissionCatalogue();
  await seedReferenceData(prisma);

  await upsertUser(prisma, "admin", "مدير النظام", "SUPER_ADMIN", "1234");
  await upsertUser(prisma, "ahmed", "أحمد", "PREPARER", "1234");
  await upsertUser(prisma, "mostafa", "مصطفى", "LOADER", "1234");
  await upsertUser(prisma, "sara", "سارة", "SUPERVISOR", "1234");
  await upsertUser(prisma, "hossam", "حسام", "STOCK_CONTROLLER", "1234");
  await upsertUser(prisma, "mona", "منى", "SALES", "1234");
  await upsertUser(prisma, "karim", "كريم", "ACCOUNTANT", "1234");
  await upsertUser(prisma, "omar", "عمر", "PURCHASER", "1234");

  const today = new Date().toISOString().slice(0, 10);

  // Order 1: fresh from n8n, untouched.
  await prisma.order.create({
    data: {
      orderNumber: "UN-DEMO-0001",
      customerName: "فندق جراند",
      deliveryDate: today,
      deliveryTime: "08:00",
      source: "n8n",
      status: "new",
      items: {
        create: [
          { productName: "مانجا", unit: "KG", requiredQuantity: 25 },
          { productName: "هليون", unit: "KG", requiredQuantity: 10 },
        ],
      },
    },
  });

  // Order 2: mid-preparation, one item short (feeds the shortage/needs_review demo).
  await prisma.order.create({
    data: {
      orderNumber: "UN-DEMO-0002",
      customerName: "مطعم النيل",
      deliveryDate: today,
      deliveryTime: "09:30",
      source: "n8n",
      status: "preparing",
      shortage: true,
      needsReview: true,
      items: {
        create: [
          {
            productName: "فراولة",
            unit: "KG",
            requiredQuantity: 20,
            preparedQuantity: 14,
            preparationStatus: "done",
          },
          {
            productName: "بطاطس",
            unit: "KG",
            requiredQuantity: 40,
            preparedQuantity: 40,
            preparationStatus: "done",
          },
        ],
      },
    },
  });

  // Order 3: ready for loading, fully prepared.
  await prisma.order.create({
    data: {
      orderNumber: "UN-DEMO-0003",
      customerName: "سوبر ماركت الأمانة",
      deliveryDate: today,
      deliveryTime: "07:00",
      source: "manual",
      status: "ready_for_loading",
      items: {
        create: [
          {
            productName: "مانجا",
            unit: "KG",
            requiredQuantity: 60,
            preparedQuantity: 60,
            preparationStatus: "done",
          },
          {
            productName: "طماطم",
            unit: "KG",
            requiredQuantity: 100,
            preparedQuantity: 100,
            preparationStatus: "done",
          },
        ],
      },
    },
  });

  // Order 4: already dispatched (history/timeline demo).
  await prisma.order.create({
    data: {
      orderNumber: "UN-DEMO-0004",
      customerName: "كافيه داون تاون",
      deliveryDate: today,
      deliveryTime: "06:30",
      source: "n8n",
      status: "dispatched",
      vehicle: "عربية 3",
      items: {
        create: [
          {
            productName: "هليون",
            unit: "KG",
            requiredQuantity: 15,
            preparedQuantity: 15,
            loadedQuantity: 15,
            preparationStatus: "done",
            loadingStatus: "done",
          },
        ],
      },
    },
  });

  console.log(
    "Seed done. TEST users (password 1234 — never in production): admin, sara, hossam, ahmed, mostafa, mona, karim, omar"
  );
}

function refuseProductionTarget() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {}
  if (/supabase\.(co|com)$/.test(host) && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error(`Refusing to seed demo data into "${host}" — that is a hosted (production) database.`);
    process.exit(2);
  }
}

if (require.main === module) {
  refuseProductionTarget();
  const prisma = new PrismaClient();
  runSeed(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
