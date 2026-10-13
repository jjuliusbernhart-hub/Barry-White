import { getDashboardData } from "@/lib/dashboard";

function csvCell(value: string | number | null) {
  if (value === null) return "";
  let text = typeof value === "number" ? value.toFixed(2).replace(".", ",") : value;

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const data = await getDashboardData();
  const headers = [
    "QuickBooks ID",
    "SKU",
    "Produkt",
    "Bestand",
    "QuickBooks Lagerwert",
    "Eingekaufte Menge",
    "Ø Einkaufspreis",
    "Zugeordnete Nebenkosten",
    "Landed Cost",
    "Datenstand",
  ];
  const rows = data.products.map((product) => [
    product.qboId,
    product.sku ?? "",
    product.name,
    product.quantity,
    product.inventoryValue,
    product.purchasedQuantity,
    product.averagePurchaseCost,
    product.allocatedCosts,
    product.landedCost,
    data.connection?.lastSyncAt ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="berrywhite-lager-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
