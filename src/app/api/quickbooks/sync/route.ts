import { NextResponse } from "next/server";
import { hasValidOrigin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { syncQuickBooks } from "@/lib/quickbooks/sync";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  try {
    const connection =
      (await prisma.qboConnection.findFirst({
        where: { status: { in: ["CONNECTED", "ERROR"] } },
        orderBy: { updatedAt: "desc" },
      })) ??
      (await prisma.qboConnection.findFirst({
        where: { status: "DEMO" },
      }));

    if (!connection) {
      return NextResponse.json(
        { error: "Keine QuickBooks-Verbindung vorhanden." },
        { status: 404 },
      );
    }

    await syncQuickBooks(connection.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Synchronisation fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
