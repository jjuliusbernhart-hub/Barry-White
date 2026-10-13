"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  PackageCheck,
  Ship,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  sku: string | null;
};

type OpenCost = {
  id: string;
  description: string;
  accountName: string | null;
  amount: number;
  category: string;
  vendorName: string | null;
  docNumber: string | null;
  currency: string;
  txnDate: string;
};

const categoryMeta: Record<
  string,
  { label: string; icon: typeof Ship; className: string }
> = {
  SHIPPING: {
    label: "Versand",
    icon: Ship,
    className: "bg-sky-50 text-sky-700 ring-sky-600/10",
  },
  LAB: {
    label: "Labor",
    icon: FlaskConical,
    className: "bg-violet-50 text-violet-700 ring-violet-600/10",
  },
  CUSTOMS: {
    label: "Zoll",
    icon: PackageCheck,
    className: "bg-amber-50 text-amber-800 ring-amber-600/10",
  },
  PACKAGING: {
    label: "Verpackung",
    icon: PackageCheck,
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  },
  OTHER: {
    label: "Sonstiges",
    icon: PackageCheck,
    className: "bg-stone-100 text-stone-700 ring-stone-600/10",
  },
};

function euro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function CostRow({
  cost,
  products,
}: {
  cost: OpenCost;
  products: Product[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [amount, setAmount] = useState(cost.amount.toFixed(2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = categoryMeta[cost.category] ?? categoryMeta.OTHER;
  const Icon = meta.icon;

  async function allocate() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/cost-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId: cost.id,
          productId,
          amount: Number(amount.replace(",", ".")),
          category: cost.category,
        }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Zuordnung fehlgeschlagen.");
      }

      router.refresh();
    } catch (allocationError) {
      setError(
        allocationError instanceof Error
          ? allocationError.message
          : "Zuordnung fehlgeschlagen.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5 border-b border-stone-200 px-6 py-5 last:border-b-0 lg:grid-cols-[1.35fr_.8fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${meta.className}`}
          >
            <Icon className="size-3.5" />
            {meta.label}
          </span>
          <span className="text-xs text-stone-400">
            {new Intl.DateTimeFormat("de-DE").format(new Date(cost.txnDate))}
          </span>
        </div>
        <p className="mt-2.5 truncate font-medium text-[#1b2d22]">
          {cost.description}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {cost.vendorName ?? "Unbekannter Lieferant"}
          {cost.docNumber ? ` · ${cost.docNumber}` : ""}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          Noch zu verteilen
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-[#1b2d22]">
          {euro(cost.amount)}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
        <select
          aria-label={`Produkt für ${cost.description}`}
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="h-10 min-w-48 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-[#2f6b46] focus:ring-2 focus:ring-[#2f6b46]/10"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <div className="relative">
            <input
              aria-label="Zuzuordnender Betrag"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-10 w-28 rounded-xl border border-stone-200 bg-white px-3 pr-7 text-right text-sm font-medium outline-none transition focus:border-[#2f6b46] focus:ring-2 focus:ring-[#2f6b46]/10"
            />
            <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-stone-400">
              €
            </span>
          </div>
          <button
            type="button"
            onClick={allocate}
            disabled={pending || !productId}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1d4b31] px-4 text-sm font-semibold text-white transition hover:bg-[#153b27] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Speichert …" : "Zuordnen"}
            {!pending && <ArrowRight className="size-4" />}
          </button>
        </div>
        {error && (
          <p className="text-xs font-medium text-red-600 sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function CostAllocationPanel({
  costs,
  products,
}: {
  costs: OpenCost[];
  products: Product[];
}) {
  return (
    <section
      id="kosten"
      className="overflow-hidden rounded-[22px] border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(26,45,34,0.03)]"
    >
      <div className="flex flex-col gap-3 border-b border-stone-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#17291e]">
              Offene Nebenkosten
            </h2>
            {costs.length > 0 && (
              <span className="rounded-full bg-[#f2eee4] px-2 py-0.5 text-xs font-semibold text-[#756747]">
                {costs.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Kosten aus QuickBooks, die noch keinem Produkt zugeordnet sind.
          </p>
        </div>
        <span className="text-xs font-medium text-stone-400">
          Änderungen bleiben außerhalb von QuickBooks
        </span>
      </div>

      {costs.length ? (
        costs.map((cost) => (
          <CostRow key={cost.id} cost={cost} products={products} />
        ))
      ) : (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-5" />
          </span>
          <p className="mt-3 font-semibold text-[#1b2d22]">
            Alle Nebenkosten sind geklärt
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Aktuell wartet keine Kostenzeile auf eine Zuordnung.
          </p>
        </div>
      )}
    </section>
  );
}
