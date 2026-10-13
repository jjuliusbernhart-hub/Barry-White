import {
  AllocationStatus,
  ConnectionStatus,
  CostCategory,
  PrismaClient,
  SyncStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.qboConnection.findUnique({
    where: { realmId: "demo-berrywhite" },
  });

  if (existing) {
    await prisma.qboConnection.delete({ where: { id: existing.id } });
  }

  const connection = await prisma.qboConnection.create({
    data: {
      realmId: "demo-berrywhite",
      companyName: "BerryWhite Sandbox",
      environment: "sandbox",
      status: ConnectionStatus.DEMO,
      lastSyncAt: new Date("2026-09-10T12:30:00Z"),
    },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        connectionId: connection.id,
        qboId: "101",
        sku: "BW-CBD-10",
        name: "CBD Öl 10% · 10 ml",
        qtyOnHand: 486,
        purchaseCost: 7.4,
        unitPrice: 24.9,
        inventoryValue: 3596.4,
      },
    }),
    prisma.product.create({
      data: {
        connectionId: connection.id,
        qboId: "102",
        sku: "BW-ISO-CBG",
        name: "CBG Isolat 99%",
        qtyOnHand: 42.5,
        purchaseCost: 268,
        unitPrice: 395,
        inventoryValue: 11390,
      },
    }),
    prisma.product.create({
      data: {
        connectionId: connection.id,
        qboId: "103",
        sku: "BW-FLW-001",
        name: "Hanfblüten Berry White",
        qtyOnHand: 18.4,
        purchaseCost: 260,
        unitPrice: 490,
        inventoryValue: 4784,
      },
    }),
    prisma.product.create({
      data: {
        connectionId: connection.id,
        qboId: "104",
        sku: "BW-TER-CIT",
        name: "Terpene Blend · Citrus",
        qtyOnHand: 96,
        purchaseCost: 32.5,
        unitPrice: 69,
        inventoryValue: 3120,
      },
    }),
    prisma.product.create({
      data: {
        connectionId: connection.id,
        qboId: "105",
        sku: "BW-PKG-010",
        name: "Braunglasflasche · 10 ml",
        qtyOnHand: 1240,
        purchaseCost: 0.72,
        unitPrice: 1.2,
        inventoryValue: 892.8,
      },
    }),
  ]);
  const bySku = new Map(products.map((product) => [product.sku, product]));

  async function addPurchase(input: {
    qboId: string;
    date: string;
    docNumber: string;
    vendor: string;
    lines: Array<{
      qboLineId: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
    }>;
  }) {
    return prisma.transaction.create({
      data: {
        connectionId: connection.id,
        qboId: input.qboId,
        type: "Bill",
        txnDate: new Date(`${input.date}T00:00:00Z`),
        docNumber: input.docNumber,
        vendorName: input.vendor,
        totalAmount: input.lines.reduce(
          (sum, line) => sum + line.quantity * line.unitPrice,
          0,
        ),
        lines: {
          create: input.lines.map((line) => ({
            qboLineId: line.qboLineId,
            productId: bySku.get(line.productSku)?.id,
            description: bySku.get(line.productSku)?.name,
            detailType: "ItemBasedExpenseLineDetail",
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.quantity * line.unitPrice,
            allocationStatus: AllocationStatus.ALLOCATED,
          })),
        },
      },
    });
  }

  await addPurchase({
    qboId: "bill-2001",
    date: "2026-04-04",
    docNumber: "EU-2026-1804",
    vendor: "Nordic Extracts AB",
    lines: [
      {
        qboLineId: "1",
        productSku: "BW-ISO-CBG",
        quantity: 10,
        unitPrice: 250,
      },
      {
        qboLineId: "2",
        productSku: "BW-CBD-10",
        quantity: 300,
        unitPrice: 7.1,
      },
    ],
  });
  await addPurchase({
    qboId: "bill-2002",
    date: "2026-07-18",
    docNumber: "EU-2026-2941",
    vendor: "Nordic Extracts AB",
    lines: [
      {
        qboLineId: "1",
        productSku: "BW-ISO-CBG",
        quantity: 15,
        unitPrice: 280,
      },
      {
        qboLineId: "2",
        productSku: "BW-CBD-10",
        quantity: 250,
        unitPrice: 7.75,
      },
    ],
  });
  await addPurchase({
    qboId: "bill-2003",
    date: "2026-08-03",
    docNumber: "BW-8427",
    vendor: "Green Fields Europe",
    lines: [
      {
        qboLineId: "1",
        productSku: "BW-FLW-001",
        quantity: 30,
        unitPrice: 260,
      },
      {
        qboLineId: "2",
        productSku: "BW-TER-CIT",
        quantity: 120,
        unitPrice: 32.5,
      },
    ],
  });
  await addPurchase({
    qboId: "bill-2004",
    date: "2026-08-20",
    docNumber: "PACK-11982",
    vendor: "Glass & Co.",
    lines: [
      {
        qboLineId: "1",
        productSku: "BW-PKG-010",
        quantity: 2000,
        unitPrice: 0.72,
      },
    ],
  });

  const allocatedShipping = await prisma.transaction.create({
    data: {
      connectionId: connection.id,
      qboId: "purchase-3001",
      type: "Purchase",
      txnDate: new Date("2026-07-19T00:00:00Z"),
      docNumber: "DHL-7719",
      vendorName: "DHL Freight",
      totalAmount: 240,
      lines: {
        create: {
          qboLineId: "1",
          description: "International freight Stockholm → Berlin",
          detailType: "AccountBasedExpenseLineDetail",
          accountName: "Shipping & freight",
          amount: 240,
          suggestedCategory: CostCategory.SHIPPING,
          allocationStatus: AllocationStatus.ALLOCATED,
        },
      },
    },
    include: { lines: true },
  });

  await prisma.costAllocation.createMany({
    data: [
      {
        lineId: allocatedShipping.lines[0].id,
        productId: bySku.get("BW-ISO-CBG")!.id,
        category: CostCategory.SHIPPING,
        amount: 120,
        note: "Nach Warenwert verteilt",
      },
      {
        lineId: allocatedShipping.lines[0].id,
        productId: bySku.get("BW-CBD-10")!.id,
        category: CostCategory.SHIPPING,
        amount: 120,
        note: "Nach Warenwert verteilt",
      },
    ],
  });

  const openCosts = [
    {
      qboId: "bill-3002",
      date: "2026-09-02",
      docNumber: "LAB-260902",
      vendor: "Eurofins Analytics",
      amount: 680,
      description: "Laboranalyse · Cannabinoidprofil",
      account: "Laboranalysen",
      category: CostCategory.LAB,
    },
    {
      qboId: "purchase-3003",
      date: "2026-09-05",
      docNumber: "ZOLL-88301",
      vendor: "Zollamt Berlin",
      amount: 315,
      description: "Einfuhrabgaben Lieferung EU-2026-2941",
      account: "Zoll & Einfuhr",
      category: CostCategory.CUSTOMS,
    },
  ];

  for (const cost of openCosts) {
    await prisma.transaction.create({
      data: {
        connectionId: connection.id,
        qboId: cost.qboId,
        type: cost.qboId.startsWith("bill") ? "Bill" : "Purchase",
        txnDate: new Date(`${cost.date}T00:00:00Z`),
        docNumber: cost.docNumber,
        vendorName: cost.vendor,
        totalAmount: cost.amount,
        lines: {
          create: {
            qboLineId: "1",
            description: cost.description,
            detailType: "AccountBasedExpenseLineDetail",
            accountName: cost.account,
            amount: cost.amount,
            suggestedCategory: cost.category,
          },
        },
      },
    });
  }

  const run = await prisma.syncRun.create({
    data: {
      connectionId: connection.id,
      status: SyncStatus.SUCCESS,
      startedAt: new Date("2026-09-10T12:29:42Z"),
      completedAt: new Date("2026-09-10T12:30:00Z"),
      importedItems: products.length,
      importedTransactions: 7,
    },
  });

  await prisma.inventorySnapshot.createMany({
    data: products.map((product) => ({
      productId: product.id,
      syncRunId: run.id,
      qtyOnHand: product.qtyOnHand,
      inventoryValue: product.inventoryValue,
      capturedAt: new Date("2026-09-10T12:30:00Z"),
    })),
  });

  await prisma.auditEvent.create({
    data: {
      action: "DEMO_SEEDED",
      entityType: "QboConnection",
      entityId: connection.id,
      details: { products: products.length, openCosts: openCosts.length },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
