import {
  AlertCircle,
  ArrowDownToLine,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Link2,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
} from "lucide-react";
import { CostAllocationPanel } from "@/components/cost-allocation-panel";
import { SyncButton } from "@/components/sync-button";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

function euro(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "Noch nie";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const noticeText: Record<string, string> = {
  "quickbooks-not-configured":
    "Hinterlege zuerst die QuickBooks-Sandbox-Zugangsdaten in der .env-Datei.",
  "quickbooks-connected":
    "QuickBooks wurde verbunden. Starte jetzt die erste Synchronisation.",
  "quickbooks-denied": "Die QuickBooks-Verbindung wurde abgebrochen.",
  "quickbooks-invalid-callback":
    "Die QuickBooks-Antwort konnte nicht sicher verifiziert werden.",
  "quickbooks-error":
    "QuickBooks konnte nicht verbunden werden. Prüfe Konfiguration und Logs.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ notice }, data] = await Promise.all([
    searchParams,
    getDashboardData(),
  ]);
  const isDemo = data.connection?.status === "DEMO";
  const isError = data.connection?.status === "ERROR";
  const lastRun = data.recentRuns[0];

  return (
    <div className="min-h-screen bg-[#f5f4f0] text-[#17291e]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[#173b28] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="relative grid size-10 place-items-center rounded-xl bg-[#f2e7cc] text-sm font-black tracking-[-0.08em] text-[#173b28] shadow-inner">
            BW
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#173b28] bg-[#d66c4b]" />
          </div>
          <div>
            <p className="font-semibold leading-none tracking-tight">
              BerryWhite
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Operations
            </p>
          </div>
        </div>

        <nav className="mt-10 space-y-1">
          {[
            {
              href: "#uebersicht",
              label: "Übersicht",
              icon: LayoutDashboard,
              active: true,
            },
            { href: "#produkte", label: "Produkte", icon: Boxes },
            {
              href: "#kosten",
              label: "Nebenkosten",
              icon: ReceiptText,
              badge: data.openCosts.length,
            },
            {
              href: "#synchronisation",
              label: "Synchronisation",
              icon: RefreshCw,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  item.active
                    ? "bg-white/11 text-white shadow-sm"
                    : "text-white/62 hover:bg-white/7 hover:text-white"
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={1.8} />
                <span>{item.label}</span>
                {Boolean(item.badge) && (
                  <span className="ml-auto rounded-full bg-[#d66c4b] px-2 py-0.5 text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <span
                className={`mt-1 size-2 rounded-full ${
                  isError ? "bg-red-400" : "bg-[#7ed69b] soft-pulse"
                }`}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">
                  {data.connection?.companyName ?? "Nicht verbunden"}
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {isDemo ? "Sandbox · Demo" : "QuickBooks Online"}
                </p>
              </div>
            </div>
            <a
              href="/api/quickbooks/connect"
              className="mt-3 flex h-8 items-center justify-center gap-2 rounded-lg bg-white/8 text-[11px] font-semibold text-white/75 transition hover:bg-white/13 hover:text-white"
            >
              <Link2 className="size-3.5" />
              QuickBooks verbinden
            </a>
          </div>
          <div className="mt-4 flex items-center gap-2 px-2 text-[10px] text-white/35">
            <ShieldCheck className="size-3.5" />
            Read-only Accounting Connector
          </div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <div className="border-b border-stone-200/80 bg-white px-5 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-[#173b28] text-[11px] font-black text-white">
                BW
              </span>
              <span className="font-semibold tracking-tight">BerryWhite</span>
            </div>
            <a
              href="#kosten"
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold"
            >
              {data.openCosts.length}{" "}
              {data.openCosts.length === 1
                ? "offene Kostenzeile"
                : "offene Kosten"}
            </a>
          </div>
        </div>

        <main
          id="uebersicht"
          className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9"
        >
          <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d72]">
                <Gauge className="size-3.5" />
                Inventory Intelligence
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#14261b] sm:text-[38px]">
                Lager &amp; Produktkosten
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                QuickBooks bleibt die Quelle für Bestand und Buchwert. Hier
                werden Einkaufspreise und Nebenkosten transparent ausgewertet.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="/api/export"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
              >
                <ArrowDownToLine className="size-4" />
                CSV für Excel
              </a>
              <SyncButton />
            </div>
          </header>

          {notice && noticeText[notice] && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{noticeText[notice]}</p>
            </div>
          )}
          {isDemo && (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#d7dfd2] bg-[#edf3ea] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-[#2f6b46]" />
                <p className="text-sm text-[#395642]">
                  <strong className="font-semibold text-[#21422e]">
                    Demo-Sandbox aktiv.
                  </strong>{" "}
                  Alle Funktionen können mit Beispieldaten getestet werden.
                </p>
              </div>
              <a
                href="/api/quickbooks/connect"
                className="ml-7 text-xs font-semibold text-[#24583a] underline decoration-[#24583a]/30 underline-offset-4 sm:ml-0"
              >
                Echte Sandbox verbinden
              </a>
            </div>
          )}

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "QuickBooks Lagerwert",
                value: euro(data.totals.inventoryValue),
                detail: `${data.products.length} aktive Produkte`,
                icon: CircleDollarSign,
                accent: "bg-[#e8f0e8] text-[#2f6b46]",
              },
              {
                label: "Aktueller Bestand",
                value: number(data.totals.quantity),
                detail: "Mengeneinheiten aus QBO",
                icon: Boxes,
                accent: "bg-[#eceaf4] text-[#665c91]",
              },
              {
                label: "Zugeordnete Nebenkosten",
                value: euro(data.totals.allocatedCostAmount),
                detail: "In Management-Kosten enthalten",
                icon: FileSpreadsheet,
                accent: "bg-[#e7eef2] text-[#496d7c]",
              },
              {
                label: "Noch ungeklärt",
                value: euro(data.totals.openCostAmount),
                detail: `${data.openCosts.length} ${
                  data.openCosts.length === 1 ? "Kostenzeile" : "Kostenzeilen"
                } prüfen`,
                icon: AlertCircle,
                accent: "bg-[#f6eadf] text-[#b06443]",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-[20px] border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(26,45,34,0.03)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                        {card.label}
                      </p>
                      <p className="mt-2.5 text-2xl font-semibold tracking-[-0.035em] text-[#17291e]">
                        {card.value}
                      </p>
                    </div>
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${card.accent}`}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.8} />
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-stone-400">{card.detail}</p>
                </div>
              );
            })}
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_360px]">
            <section
              id="produkte"
              className="overflow-hidden rounded-[22px] border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(26,45,34,0.03)]"
            >
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-[#17291e]">
                    Produktübersicht
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Bestand und Buchwert direkt aus QuickBooks
                  </p>
                </div>
                <PackageSearch className="size-5 text-stone-300" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-100 bg-[#fbfbf9] text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                      <th className="px-6 py-3.5">Produkt</th>
                      <th className="px-4 py-3.5 text-right">Bestand</th>
                      <th className="px-4 py-3.5 text-right">QBO-Lagerwert</th>
                      <th className="px-4 py-3.5 text-right">Ø Einkauf</th>
                      <th className="px-6 py-3.5 text-right">Landed Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-stone-100 last:border-0 hover:bg-[#fafbf8]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf2eb] text-xs font-bold text-[#315a3f]">
                              {product.name
                                .split(" ")
                                .slice(0, 2)
                                .map((word) => word[0])
                                .join("")}
                            </span>
                            <div>
                              <p className="font-medium text-[#1b2d22]">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-[11px] font-medium tracking-wide text-stone-400">
                                {product.sku ?? `QBO #${product.qboId}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-semibold tabular-nums text-stone-700">
                            {number(product.quantity)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-emerald-700">
                            QBO aktuell
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-stone-700">
                          {euro(product.inventoryValue)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-medium tabular-nums text-stone-700">
                            {euro(
                              product.averagePurchaseCost ??
                                product.purchaseCost,
                            )}
                          </p>
                          <p className="mt-0.5 text-[10px] text-stone-400">
                            gewichtete Analyse
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-semibold tabular-nums text-[#24583a]">
                            {euro(
                              product.landedCost ?? product.purchaseCost,
                            )}
                          </p>
                          <p className="mt-0.5 text-[10px] text-stone-400">
                            inkl. Zuordnungen
                          </p>
                        </td>
                      </tr>
                    ))}
                    {!data.products.length && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-16 text-center text-sm text-stone-500"
                        >
                          Verbinde QuickBooks und starte die erste
                          Synchronisation.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-5">
              <section
                id="synchronisation"
                className="rounded-[22px] border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(26,45,34,0.03)]"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold tracking-tight text-[#17291e]">
                    Systemstatus
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isError
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isError ? "bg-red-500" : "bg-emerald-500"
                      }`}
                    />
                    {isError ? "Fehler" : isDemo ? "Demo" : "Verbunden"}
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  <StatusRow
                    icon={Clock3}
                    label="Letzter erfolgreicher Sync"
                    value={dateTime(data.connection?.lastSyncAt ?? null)}
                  />
                  <StatusRow
                    icon={ArrowDownToLine}
                    label="Letzter Lauf"
                    value={
                      lastRun
                        ? `${lastRun.importedItems} Produkte · ${lastRun.importedTransactions} Belege`
                        : "Noch kein Import"
                    }
                  />
                  <StatusRow
                    icon={ShieldCheck}
                    label="Zugriffsmodus"
                    value="Nur lesen"
                  />
                </div>
                {data.connection?.lastError && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">
                    {data.connection.lastError}
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-[22px] bg-[#203e2c] p-5 text-white shadow-sm">
                <div className="flex items-center gap-2 text-[#acd2b7]">
                  <ShieldCheck className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                    Datenprinzip
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold leading-6 tracking-tight">
                  Ein Produkt bleibt ein Produkt.
                </p>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Unterschiedliche Einkaufspreise werden als eigene Vorgänge
                  historisiert. Der QuickBooks-Buchwert wird niemals
                  überschrieben.
                </p>
                <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-medium text-white/55">
                  <CheckCircle2 className="size-4 text-[#82cf9a]" />
                  Nachvollziehbar statt geschätzt
                </div>
              </section>
            </div>
          </div>

          <div className="mt-5">
            <CostAllocationPanel
              costs={data.openCosts}
              products={data.products.map(({ id, name, sku }) => ({
                id,
                name,
                sku,
              }))}
            />
          </div>

          {!data.quickBooksConfigured && (
            <section className="mt-5 flex flex-col gap-4 rounded-[22px] border border-dashed border-stone-300 bg-white/55 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500">
                  <Unplug className="size-4" />
                </span>
                <div>
                  <p className="font-semibold text-stone-700">
                    Echte QuickBooks-Sandbox noch nicht konfiguriert
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Kopiere die Intuit-Zugangsdaten in{" "}
                    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
                      .env
                    </code>
                    .
                  </p>
                </div>
              </div>
              <a
                href="https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes/manage-your-sandboxes"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-semibold text-stone-600 transition hover:border-stone-300"
              >
                <Settings2 className="size-3.5" />
                Sandbox einrichten
              </a>
            </section>
          )}

          <footer className="flex flex-col gap-2 px-1 pb-2 pt-8 text-[11px] text-stone-400 sm:flex-row sm:items-center sm:justify-between">
            <p>BerryWhite Operations · QuickBooks bleibt führendes System</p>
            <p>Management-Kosten sind keine buchhalterische Lagerbewertung.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs font-medium text-stone-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-stone-700">{value}</p>
      </div>
    </div>
  );
}
