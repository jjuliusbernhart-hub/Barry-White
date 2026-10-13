import { calculateProductCosts } from "@/lib/costs";
import { prisma } from "@/lib/prisma";
import { isQuickBooksConfigured } from "@/lib/quickbooks/client";

export async function getDashboardData() {
  const connection =
    (await prisma.qboConnection.findFirst({
      where: { status: "CONNECTED" },
      orderBy: { updatedAt: "desc" },
    })) ??
    (await prisma.qboConnection.findFirst({
      orderBy: { updatedAt: "desc" },
    }));

  if (!connection) {
    return {
      connection: null,
      quickBooksConfigured: isQuickBooksConfigured(),
      products: [],
      openCosts: [],
      recentRuns: [],
      totals: {
        inventoryValue: 0,
        quantity: 0,
        openCostAmount: 0,
        allocatedCostAmount: 0,
      },
    };
  }

  const [products, purchaseLines, allocations, openCosts, recentRuns] =
    await Promise.all([
      prisma.product.findMany({
        where: { connectionId: connection.id, active: true },
        orderBy: { inventoryValue: "desc" },
      }),
      prisma.transactionLine.findMany({
        where: {
          productId: { not: null },
          transaction: {
            connectionId: connection.id,
            sourceStatus: "ACTIVE",
          },
        },
        include: {
          transaction: { select: { type: true } },
        },
      }),
      prisma.costAllocation.findMany({
        where: {
          product: { connectionId: connection.id },
          line: { transaction: { sourceStatus: "ACTIVE" } },
        },
      }),
      prisma.transactionLine.findMany({
        where: {
          productId: null,
          amount: { gt: 0 },
          allocationStatus: "OPEN",
          transaction: {
            connectionId: connection.id,
            sourceStatus: "ACTIVE",
          },
        },
        include: {
          transaction: {
            select: {
              txnDate: true,
              docNumber: true,
              vendorName: true,
              currency: true,
            },
          },
          allocations: { select: { amount: true } },
        },
        orderBy: { transaction: { txnDate: "desc" } },
      }),
      prisma.syncRun.findMany({
        where: { connectionId: connection.id },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
    ]);

  const normalizedLines = purchaseLines.map((line) => {
    const sign = line.transaction.type === "VendorCredit" ? -1 : 1;
    return {
      productId: line.productId,
      quantity: line.quantity ? Number(line.quantity) * sign : null,
      amount: Number(line.amount) * sign,
    };
  });
  const normalizedAllocations = allocations.map((allocation) => ({
    productId: allocation.productId,
    amount: Number(allocation.amount),
  }));
  const productViews = products.map((product) => ({
    id: product.id,
    qboId: product.qboId,
    sku: product.sku,
    name: product.name,
    quantity: Number(product.qtyOnHand),
    purchaseCost: Number(product.purchaseCost),
    unitPrice: Number(product.unitPrice),
    inventoryValue: product.inventoryValue
      ? Number(product.inventoryValue)
      : null,
    ...calculateProductCosts(
      product.id,
      normalizedLines,
      normalizedAllocations,
    ),
  }));

  return {
    connection: {
      id: connection.id,
      companyName: connection.companyName,
      environment: connection.environment,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      lastError: connection.lastError,
    },
    quickBooksConfigured: isQuickBooksConfigured(),
    products: productViews,
    openCosts: openCosts.map((line) => {
      const allocated = line.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0,
      );
      return {
        id: line.id,
        description: line.description || line.accountName || "Zusatzkosten",
        accountName: line.accountName,
        amount: Math.max(0, Number(line.amount) - allocated),
        category: line.suggestedCategory ?? "OTHER",
        vendorName: line.transaction.vendorName,
        docNumber: line.transaction.docNumber,
        currency: line.transaction.currency,
        txnDate: line.transaction.txnDate.toISOString(),
      };
    }),
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      importedItems: run.importedItems,
      importedTransactions: run.importedTransactions,
      error: run.error,
    })),
    totals: {
      inventoryValue: productViews.reduce(
        (sum, product) => sum + (product.inventoryValue ?? 0),
        0,
      ),
      quantity: productViews.reduce(
        (sum, product) => sum + product.quantity,
        0,
      ),
      openCostAmount: openCosts.reduce((sum, line) => {
        const allocated = line.allocations.reduce(
          (allocationSum, allocation) =>
            allocationSum + Number(allocation.amount),
          0,
        );
        return sum + Math.max(0, Number(line.amount) - allocated);
      }, 0),
      allocatedCostAmount: allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0,
      ),
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
