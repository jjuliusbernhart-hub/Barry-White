import { CostCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasValidOrigin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const allocationSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  amount: z.number().positive(),
  category: z.nativeEnum(CostCategory),
  note: z.string().max(240).optional(),
});

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  try {
    const input = allocationSchema.parse(await request.json());
    const [line, product, existing] = await Promise.all([
      prisma.transactionLine.findUnique({
        where: { id: input.lineId },
        include: {
          transaction: { select: { connectionId: true, sourceStatus: true } },
        },
      }),
      prisma.product.findUnique({
        where: { id: input.productId },
        select: { id: true, connectionId: true, name: true },
      }),
      prisma.costAllocation.aggregate({
        where: { lineId: input.lineId },
        _sum: { amount: true },
      }),
    ]);

    if (
      !line ||
      !product ||
      line.transaction.sourceStatus !== "ACTIVE" ||
      line.transaction.connectionId !== product.connectionId
    ) {
      return NextResponse.json(
        { error: "Kostenzeile oder Produkt wurde nicht gefunden." },
        { status: 404 },
      );
    }

    const allocated = Number(existing._sum.amount ?? 0);
    const available = Number(line.amount) - allocated;
    if (input.amount > available + 0.01) {
      return NextResponse.json(
        {
          error: `Es können höchstens ${available.toFixed(2)} zugeordnet werden.`,
        },
        { status: 422 },
      );
    }

    const isComplete = available - input.amount <= 0.01;
    const allocation = await prisma.$transaction(async (database) => {
      const created = await database.costAllocation.create({
        data: {
          lineId: input.lineId,
          productId: input.productId,
          amount: input.amount,
          category: input.category,
          note: input.note,
        },
      });
      await database.transactionLine.update({
        where: { id: input.lineId },
        data: { allocationStatus: isComplete ? "ALLOCATED" : "OPEN" },
      });
      await database.auditEvent.create({
        data: {
          action: "COST_ALLOCATED",
          entityType: "CostAllocation",
          entityId: created.id,
          details: {
            lineId: input.lineId,
            productId: input.productId,
            productName: product.name,
            amount: input.amount,
            category: input.category,
          },
        },
      });
      return created;
    });

    return NextResponse.json({ ok: true, allocation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Bitte prüfe Produkt, Betrag und Kostenart." },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Zuordnung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
