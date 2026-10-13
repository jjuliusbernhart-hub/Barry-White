import { createHash } from "node:crypto";
import {
  AllocationStatus,
  Prisma,
  SyncStatus,
  type QboConnection,
} from "@prisma/client";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { suggestCostCategory } from "@/lib/costs";
import { prisma } from "@/lib/prisma";
import {
  getInventoryValuationSummary,
  queryAll,
  refreshTokens,
} from "./client";
import type {
  QboItem,
  QboLine,
  QboReport,
  QboReportRow,
  QboTransaction,
} from "./types";

type PurchaseEntityType = "Bill" | "Purchase" | "VendorCredit";

type InventoryReportValue = {
  qboId?: string;
  name: string;
  value: number | null;
};

function numericReportValue(value?: string) {
  if (!value || value === "-") return null;
  const negative = value.startsWith("(") && value.endsWith(")");
  const normalized = value
    .replace(/[()€$£\s]/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "");
  const result = Number.parseFloat(normalized);
  return Number.isFinite(result) ? (negative ? -result : result) : null;
}

function flattenReportRows(rows: QboReportRow[]): QboReportRow[] {
  return rows.flatMap((row) => [
    row,
    ...flattenReportRows(row.Rows?.Row ?? []),
  ]);
}

function parseInventoryReport(report: QboReport): InventoryReportValue[] {
  const columns = report.Columns?.Column ?? [];
  const valueIndex = columns.findIndex((column) =>
    /(asset value|inventory value|value)/i.test(column.ColTitle ?? ""),
  );

  return flattenReportRows(report.Rows?.Row ?? [])
    .filter((row) => row.type === "Data" && row.ColData?.[0]?.value)
    .map((row) => ({
      qboId: row.ColData?.[0]?.id,
      name: row.ColData?.[0]?.value ?? "",
      value:
        valueIndex >= 0
          ? numericReportValue(row.ColData?.[valueIndex]?.value)
          : null,
    }));
}

function lineKey(line: QboLine, index: number) {
  if (line.Id) return line.Id;

  return createHash("sha256")
    .update(
      [
        line.DetailType,
        line.ItemBasedExpenseLineDetail?.ItemRef?.value,
        line.AccountBasedExpenseLineDetail?.AccountRef?.value,
        line.Description,
        line.Amount,
        index,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 24);
}

function sanitizedJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function validAccessToken(connection: QboConnection) {
  if (
    connection.accessTokenEncrypted &&
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return decryptToken(connection.accessTokenEncrypted);
  }

  if (!connection.refreshTokenEncrypted) {
    throw new Error("Die QuickBooks-Verbindung muss erneut autorisiert werden.");
  }

  const tokens = await refreshTokens(
    decryptToken(connection.refreshTokenEncrypted),
  );
  await prisma.qboConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      refreshTokenExpiresAt: tokens.x_refresh_token_expires_in
        ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000)
        : connection.refreshTokenExpiresAt,
    },
  });

  return tokens.access_token;
}

async function syncDemo(connection: QboConnection) {
  const now = new Date();

  await prisma.$transaction(async (database) => {
    const run = await database.syncRun.create({
      data: {
        connectionId: connection.id,
        status: SyncStatus.SUCCESS,
        completedAt: now,
        importedItems: await database.product.count({
          where: { connectionId: connection.id, active: true },
        }),
        importedTransactions: await database.transaction.count({
          where: { connectionId: connection.id, sourceStatus: "ACTIVE" },
        }),
      },
    });
    const products = await database.product.findMany({
      where: { connectionId: connection.id, active: true },
    });
    await Promise.all(
      products.map((product) =>
        database.inventorySnapshot.create({
          data: {
            productId: product.id,
            syncRunId: run.id,
            qtyOnHand: product.qtyOnHand,
            inventoryValue: product.inventoryValue,
            capturedAt: now,
          },
        }),
      ),
    );
    await database.qboConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: now, lastError: null },
    });
  });
}

async function upsertTransaction(
  database: Prisma.TransactionClient,
  connectionId: string,
  type: PurchaseEntityType,
  source: QboTransaction,
  productIds: Map<string, string>,
) {
  const transaction = await database.transaction.upsert({
    where: {
      connectionId_type_qboId: {
        connectionId,
        type,
        qboId: source.Id,
      },
    },
    create: {
      connectionId,
      qboId: source.Id,
      type,
      syncToken: source.SyncToken,
      txnDate: new Date(`${source.TxnDate ?? "1970-01-01"}T00:00:00Z`),
      docNumber: source.DocNumber,
      vendorName: source.VendorRef?.name,
      currency: source.CurrencyRef?.value ?? "EUR",
      totalAmount: source.TotalAmt ?? 0,
      sourceUpdatedAt: source.MetaData?.LastUpdatedTime
        ? new Date(source.MetaData.LastUpdatedTime)
        : null,
      rawPayload: sanitizedJson(source),
    },
    update: {
      syncToken: source.SyncToken,
      txnDate: new Date(`${source.TxnDate ?? "1970-01-01"}T00:00:00Z`),
      docNumber: source.DocNumber,
      vendorName: source.VendorRef?.name,
      currency: source.CurrencyRef?.value ?? "EUR",
      totalAmount: source.TotalAmt ?? 0,
      sourceStatus: "ACTIVE",
      sourceUpdatedAt: source.MetaData?.LastUpdatedTime
        ? new Date(source.MetaData.LastUpdatedTime)
        : null,
      rawPayload: sanitizedJson(source),
    },
  });

  const currentLineIds: string[] = [];

  for (const [index, line] of (source.Line ?? []).entries()) {
    const qboLineId = lineKey(line, index);
    currentLineIds.push(qboLineId);
    const itemDetail = line.ItemBasedExpenseLineDetail;
    const accountDetail = line.AccountBasedExpenseLineDetail;
    const productId = itemDetail?.ItemRef?.value
      ? productIds.get(itemDetail.ItemRef.value)
      : undefined;
    const costText = [
      line.Description,
      accountDetail?.AccountRef?.name,
      itemDetail?.ItemRef?.name,
    ]
      .filter(Boolean)
      .join(" ");

    await database.transactionLine.upsert({
      where: {
        transactionId_qboLineId: {
          transactionId: transaction.id,
          qboLineId,
        },
      },
      create: {
        transactionId: transaction.id,
        qboLineId,
        productId,
        description: line.Description,
        detailType: line.DetailType ?? "Unknown",
        accountName: accountDetail?.AccountRef?.name,
        quantity: itemDetail?.Qty,
        unitPrice: itemDetail?.UnitPrice,
        amount: line.Amount ?? 0,
        suggestedCategory: accountDetail
          ? suggestCostCategory(costText)
          : null,
        allocationStatus: productId
          ? AllocationStatus.ALLOCATED
          : AllocationStatus.OPEN,
      },
      update: {
        productId,
        description: line.Description,
        detailType: line.DetailType ?? "Unknown",
        accountName: accountDetail?.AccountRef?.name,
        quantity: itemDetail?.Qty,
        unitPrice: itemDetail?.UnitPrice,
        amount: line.Amount ?? 0,
        suggestedCategory: accountDetail
          ? suggestCostCategory(costText)
          : null,
      },
    });
  }

  await database.transactionLine.deleteMany({
    where: {
      transactionId: transaction.id,
      ...(currentLineIds.length
        ? { qboLineId: { notIn: currentLineIds } }
        : {}),
    },
  });
}

export async function syncQuickBooks(connectionId: string) {
  const connection = await prisma.qboConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  if (connection.status === "DEMO") {
    await syncDemo(connection);
    return;
  }

  const run = await prisma.syncRun.create({
    data: { connectionId: connection.id },
  });

  try {
    const accessToken = await validAccessToken(connection);
    const [items, bills, purchases, vendorCredits, report] = await Promise.all([
      queryAll<QboItem>(connection.realmId, accessToken, "Item"),
      queryAll<QboTransaction>(connection.realmId, accessToken, "Bill"),
      queryAll<QboTransaction>(connection.realmId, accessToken, "Purchase"),
      queryAll<QboTransaction>(connection.realmId, accessToken, "VendorCredit"),
      getInventoryValuationSummary(connection.realmId, accessToken),
    ]);
    const inventoryItems = items.filter(
      (item) => item.Type === "Inventory" || item.TrackQtyOnHand,
    );
    const reportValues = parseInventoryReport(report);
    const reportById = new Map(
      reportValues.filter((row) => row.qboId).map((row) => [row.qboId, row]),
    );
    const reportByName = new Map(
      reportValues.map((row) => [row.name.toLocaleLowerCase("de"), row]),
    );
    const transactionGroups = [
      ["Bill", bills],
      ["Purchase", purchases],
      ["VendorCredit", vendorCredits],
    ] as const;
    const now = new Date();

    await prisma.$transaction(async (database) => {
      await database.product.updateMany({
        where: { connectionId: connection.id },
        data: { active: false },
      });

      for (const item of inventoryItems) {
        const reportValue =
          reportById.get(item.Id) ??
          reportByName.get(item.Name.toLocaleLowerCase("de"));
        await database.product.upsert({
          where: {
            connectionId_qboId: {
              connectionId: connection.id,
              qboId: item.Id,
            },
          },
          create: {
            connectionId: connection.id,
            qboId: item.Id,
            syncToken: item.SyncToken,
            sku: item.Sku,
            name: item.Name,
            active: item.Active ?? true,
            type: item.Type ?? "Inventory",
            trackQtyOnHand: item.TrackQtyOnHand ?? false,
            qtyOnHand: item.QtyOnHand ?? 0,
            purchaseCost: item.PurchaseCost ?? 0,
            unitPrice: item.UnitPrice ?? 0,
            inventoryValue: reportValue?.value,
            sourceUpdatedAt: item.MetaData?.LastUpdatedTime
              ? new Date(item.MetaData.LastUpdatedTime)
              : null,
          },
          update: {
            syncToken: item.SyncToken,
            sku: item.Sku,
            name: item.Name,
            active: item.Active ?? true,
            type: item.Type ?? "Inventory",
            trackQtyOnHand: item.TrackQtyOnHand ?? false,
            qtyOnHand: item.QtyOnHand ?? 0,
            purchaseCost: item.PurchaseCost ?? 0,
            unitPrice: item.UnitPrice ?? 0,
            inventoryValue: reportValue?.value,
            sourceUpdatedAt: item.MetaData?.LastUpdatedTime
              ? new Date(item.MetaData.LastUpdatedTime)
              : null,
          },
        });
      }

      const products = await database.product.findMany({
        where: { connectionId: connection.id },
        select: { id: true, qboId: true },
      });
      const productIds = new Map(
        products.map((product) => [product.qboId, product.id]),
      );

      for (const [type, sources] of transactionGroups) {
        for (const source of sources) {
          await upsertTransaction(
            database,
            connection.id,
            type,
            source,
            productIds,
          );
        }
        await database.transaction.updateMany({
          where: {
            connectionId: connection.id,
            type,
            ...(sources.length
              ? { qboId: { notIn: sources.map((source) => source.Id) } }
              : {}),
          },
          data: { sourceStatus: "DELETED" },
        });
      }

      const syncedProducts = await database.product.findMany({
        where: { connectionId: connection.id, active: true },
      });
      await Promise.all(
        syncedProducts.map((product) =>
          database.inventorySnapshot.create({
            data: {
              productId: product.id,
              syncRunId: run.id,
              qtyOnHand: product.qtyOnHand,
              inventoryValue: product.inventoryValue,
              capturedAt: now,
            },
          }),
        ),
      );
      await database.syncRun.update({
        where: { id: run.id },
        data: {
          status: SyncStatus.SUCCESS,
          completedAt: now,
          importedItems: inventoryItems.length,
          importedTransactions:
            bills.length + purchases.length + vendorCredits.length,
        },
      });
      await database.qboConnection.update({
        where: { id: connection.id },
        data: {
          status: "CONNECTED",
          lastSyncAt: now,
          lastError: null,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Sync-Fehler";
    await prisma.$transaction([
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: SyncStatus.FAILED,
          completedAt: new Date(),
          error: message,
        },
      }),
      prisma.qboConnection.update({
        where: { id: connection.id },
        data: { status: "ERROR", lastError: message },
      }),
    ]);
    throw error;
  }
}
