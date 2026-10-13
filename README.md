# Barry White – BerryWhite Operations MVP

Read-only QuickBooks-Übersicht für Lagerbestand, Einkaufspreise und zugeordnete
Nebenkosten. QuickBooks bleibt das führende System für Bestände und
buchhalterische Lagerwerte.

Die Oberfläche verwendet den Namen **BerryWhite**. Der npm-Paketname ist
`berrywhite`, das GitHub-Repository heißt `Barry-White`.

## Technologien

- **TypeScript 5 / TSX**, React 19 und Next.js 16.3.4 mit App Router
- **Tailwind CSS 4** für Gestaltung und Lucide React für Icons
- **Prisma 6** mit lokaler **SQLite**-Datenbank
- **QuickBooks Online API** mit OAuth 2.0 und AES-256-GCM für gespeicherte Tokens
- **Zod** zur Validierung, **dotenv** für Umgebungsvariablen
- **ESLint 9**, **Vitest 5** und **tsx** für Entwicklung und Tests

Die vollständigen Abhängigkeiten stehen in `package.json`; `package-lock.json`
legt die installierten Versionen fest.

## Projektstruktur

```text
src/
  app/
    page.tsx                 Dashboard für Bestand und Produktkosten
    layout.tsx               Gemeinsames Layout
    globals.css              Globale Styles
    api/
      quickbooks/            OAuth-Verbindung, Callback und Synchronisation
      cost-allocations/      Zuordnung von Nebenkosten
      export/                CSV-Export
  components/                Interaktive React-Komponenten
  lib/
    quickbooks/              API-Client, Synchronisation und Datentypen
    costs.ts                 Kostenberechnung
    dashboard.ts             Daten für das Dashboard
    crypto.ts                Tokenverschlüsselung
    prisma.ts                Datenbankzugriff
    *.test.ts                Tests (auch in lib/quickbooks/)
prisma/
  schema.prisma              Datenmodell
  seed.ts                    Demodaten
public/                      Statische Grafiken
.env.example                 Konfigurationsvorlage ohne Zugangsdaten
AGENTS.md                    Hinweise für Coding-Agenten
```

## Lokal starten

Voraussetzungen: **Node.js 24.x**, npm und Git. Vitest 5 benötigt mindestens
Node.js 22.12 innerhalb der unterstützten Versionsreihen; mit Node.js 24.x
lassen sich Anwendung und Tests gemeinsam betreiben.

Nach dem Klonen im Projektordner ausführen:

```sh
cp -n .env.example .env
npm ci
npm run setup
npm run dev
```

Die Anwendung läuft unter [http://localhost:3000](http://localhost:3000).
`cp -n` bewahrt eine bereits vorhandene `.env` auf macOS. Für den Demobetrieb
reichen die Vorlagenwerte; QuickBooks-Zugangsdaten können leer bleiben.
`npm run setup` generiert den Prisma-Client, legt das Datenbankschema an und
befüllt `prisma/dev.db` mit Demodaten. Das Seed-Skript ersetzt bei erneutem
Aufruf die vorhandene Demo-Verbindung samt zugehörigen Demodaten.

Für einen lokalen Produktions-Build nach der Einrichtung:

```sh
npm run build
npm start
```

Der Build lädt die Schriftart Geist über `next/font/google` und benötigt dafür
Internetzugriff.

## Konfiguration

| Variable | Zweck |
| --- | --- |
| `DATABASE_URL` | SQLite-Verbindung, lokal `file:./dev.db` relativ zum Prisma-Schema |
| `QUICKBOOKS_CLIENT_ID` | Client-ID der eigenen Intuit-App |
| `QUICKBOOKS_CLIENT_SECRET` | Geheimes Client-Secret der Intuit-App |
| `QUICKBOOKS_REDIRECT_URI` | Lokal `http://localhost:3000/api/quickbooks/callback` |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` oder `production` |
| `TOKEN_ENCRYPTION_KEY` | 32 zufällige Bytes als 64-stelliger Hex-Wert |

Echte Werte ausschließlich lokal in `.env` oder in der geschützten
Umgebungskonfiguration hinterlegen. `.env.example` bleibt ohne Geheimnisse.
Ein bestehender Verschlüsselungsschlüssel muss erhalten bleiben, solange die
dazugehörigen gespeicherten Tokens weiterverwendet werden sollen.

## QuickBooks-Sandbox verbinden

1. Im [Intuit Developer Portal](https://developer.intuit.com/) eine App und eine
   regionale QuickBooks-Online-Sandbox anlegen.
2. `.env.example` nach `.env` übertragen.
3. Development Client-ID, Client-Secret und Redirect-URI eintragen.
4. Einen Schlüssel mit `openssl rand -hex 32` als
   `TOKEN_ENCRYPTION_KEY` eintragen.
5. Die Redirect-URI im Developer Portal exakt als
   `http://localhost:3000/api/quickbooks/callback` hinterlegen.
6. In der Anwendung „QuickBooks verbinden“ wählen und danach synchronisieren.

Der Connector ruft ausschließlich lesende Accounting-Endpunkte auf. Intuits
OAuth-Scope `com.intuit.quickbooks.accounting` selbst ist allerdings nicht
feingranular auf Lesen beschränkt. Tokens werden deshalb verschlüsselt
gespeichert.

## MVP-Funktionen

- Produkte und `QtyOnHand` aus QuickBooks
- `InventoryValuationSummary` als buchhalterischer Referenzwert
- Historische Bills, Purchases und Vendor Credits
- Gewichtete Einkaufspreise als getrennte Management-Kennzahl
- Manuelle Verteilung von Versand-, Labor-, Zoll- und anderen Nebenkosten
- Idempotenter Vollabgleich mit Löschungsmarkierung
- Synchronisations- und Fehlerstatus
- Formel-sicherer CSV-Export für Excel

## Qualität

```sh
npm run lint
npx next typegen
npm run typecheck
npm test
npm run build
```

`next typegen` erzeugt die Next.js-Routentypen für einen frischen Checkout.
`npm run db:generate` generiert nur den Prisma-Client; `npm run db:push`
übernimmt das Schema in die konfigurierte Datenbank. `npm run db:seed`
lädt die Demodaten erneut.

## Git und vertrauliche Daten

Versioniert werden Quellcode, Tests, statische Ressourcen, Prisma-Schema und
Demodaten-Skript, Konfiguration, Lockdatei und Dokumentation. `.gitignore`
schließt insbesondere `.env`-Dateien (außer der geprüften `.env.example`),
lokale SQLite-Datenbanken samt Begleitdateien, Schlüsseldateien, lokale
Zugangsdaten-Dateien, Logs, Abhängigkeiten, Build-Ausgaben und temporäre
Dateien aus. Die Datenbank kann QuickBooks-Geschäftsdaten und verschlüsselte
Tokens enthalten und gehört auch nicht in ein privates Repository.

Vor einem Commit neue Dateien und Änderungen auf Geheimnisse prüfen:
`.gitignore` erkennt keine Zugangsdaten, die direkt in Quellcode geschrieben
wurden. Bei der Zusammenarbeit mit ChatGPT nur das private Repository
freigeben; lokale Zugangsdaten werden für die Codeanalyse nicht benötigt.

SQLite und der fehlende Benutzer-Login sind für den lokalen MVP gedacht. Vor
einem öffentlichen Produktivbetrieb müssen eine verwaltete Datenbank,
Authentifizierung, Rollen und ein geplanter Synchronisationsjob ergänzt werden.
