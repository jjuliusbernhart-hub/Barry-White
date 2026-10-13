import type {
  QboItem,
  QboReport,
  QboTokenResponse,
  QboTransaction,
} from "./types";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const PAGE_SIZE = 1000;

type QboEntity = "Item" | "Bill" | "Purchase" | "VendorCredit";

type QboConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
};

function qboConfig(): QboConfig {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  const environment =
    process.env.QUICKBOOKS_ENVIRONMENT === "production"
      ? "production"
      : "sandbox";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "QuickBooks ist nicht konfiguriert. Prüfe QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET und QUICKBOOKS_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri, environment };
}

function apiBaseUrl() {
  return qboConfig().environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function isQuickBooksConfigured() {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID &&
      process.env.QUICKBOOKS_CLIENT_SECRET &&
      process.env.QUICKBOOKS_REDIRECT_URI &&
      process.env.TOKEN_ENCRYPTION_KEY,
  );
}

export function getAuthorizationUrl(state: string) {
  const config = qboConfig();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: URLSearchParams) {
  const config = qboConfig();
  const authorization = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QuickBooks OAuth fehlgeschlagen (${response.status}): ${body}`);
  }

  return (await response.json()) as QboTokenResponse;
}

export function exchangeAuthorizationCode(code: string) {
  const config = qboConfig();
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  );
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

async function qboGet<T>(
  realmId: string,
  accessToken: string,
  path: string,
  query?: URLSearchParams,
) {
  const url = new URL(`${apiBaseUrl()}/v3/company/${realmId}/${path}`);
  query?.forEach((value, key) => url.searchParams.set(key, value));
  url.searchParams.set("minorversion", "75");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QuickBooks API fehlgeschlagen (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

export async function getCompanyInfo(realmId: string, accessToken: string) {
  const response = await qboGet<{
    CompanyInfo?: { CompanyName?: string; Country?: string };
  }>(realmId, accessToken, `companyinfo/${realmId}`);

  return response.CompanyInfo;
}

export async function queryAll<T extends QboItem | QboTransaction>(
  realmId: string,
  accessToken: string,
  entity: QboEntity,
) {
  const results: T[] = [];
  let startPosition = 1;

  while (true) {
    const statement = `select * from ${entity} startposition ${startPosition} maxresults ${PAGE_SIZE}`;
    const response = await qboGet<{
      QueryResponse?: Record<string, T[] | number | undefined>;
    }>(
      realmId,
      accessToken,
      "query",
      new URLSearchParams({ query: statement }),
    );
    const page = (response.QueryResponse?.[entity] ?? []) as T[];
    results.push(...page);

    if (page.length < PAGE_SIZE) {
      return results;
    }

    startPosition += PAGE_SIZE;
  }
}

export function getInventoryValuationSummary(
  realmId: string,
  accessToken: string,
) {
  return qboGet<QboReport>(
    realmId,
    accessToken,
    "reports/InventoryValuationSummary",
    new URLSearchParams({ date_macro: "Today" }),
  );
}
