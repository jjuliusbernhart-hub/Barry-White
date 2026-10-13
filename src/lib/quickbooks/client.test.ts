import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInventoryValuationSummary,
  queryAll,
} from "./client";
import type { QboItem } from "./types";

describe("QuickBooks Read-only Connector", () => {
  beforeEach(() => {
    process.env.QUICKBOOKS_CLIENT_ID = "client";
    process.env.QUICKBOOKS_CLIENT_SECRET = "secret";
    process.env.QUICKBOOKS_REDIRECT_URI =
      "http://localhost:3000/api/quickbooks/callback";
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ruft Accounting-Reports ausschließlich per GET ab", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ Header: {}, Rows: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getInventoryValuationSummary("realm-1", "access-token");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/v3/company/realm-1/reports/InventoryValuationSummary",
    );
    expect(options?.method).toBe("GET");
  });

  it("liest Items paginiert ohne mutierende Requests", async () => {
    const item: QboItem = { Id: "1", Name: "Produkt A", Type: "Inventory" };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ QueryResponse: { Item: [item], maxResults: 1 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryAll<QboItem>("realm-1", "token", "Item");

    expect(result).toEqual([item]);
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === "GET"))
      .toBe(true);
  });
});
