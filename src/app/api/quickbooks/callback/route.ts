import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  exchangeAuthorizationCode,
  getCompanyInfo,
} from "@/lib/quickbooks/client";

function redirect(request: NextRequest, notice: string) {
  const response = NextResponse.redirect(new URL(`/?notice=${notice}`, request.url));
  response.cookies.delete("qbo_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const realmId = request.nextUrl.searchParams.get("realmId");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("qbo_oauth_state")?.value;

  if (error) return redirect(request, "quickbooks-denied");
  if (!code || !realmId || !state || state !== expectedState) {
    return redirect(request, "quickbooks-invalid-callback");
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const companyInfo = await getCompanyInfo(realmId, tokens.access_token);
    await prisma.qboConnection.upsert({
      where: { realmId },
      create: {
        realmId,
        companyName: companyInfo?.CompanyName ?? `QuickBooks ${realmId}`,
        environment:
          process.env.QUICKBOOKS_ENVIRONMENT === "production"
            ? "production"
            : "sandbox",
        status: "CONNECTED",
        accessTokenEncrypted: encryptToken(tokens.access_token),
        refreshTokenEncrypted: encryptToken(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshTokenExpiresAt: tokens.x_refresh_token_expires_in
          ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000)
          : null,
      },
      update: {
        companyName: companyInfo?.CompanyName ?? `QuickBooks ${realmId}`,
        environment:
          process.env.QUICKBOOKS_ENVIRONMENT === "production"
            ? "production"
            : "sandbox",
        status: "CONNECTED",
        accessTokenEncrypted: encryptToken(tokens.access_token),
        refreshTokenEncrypted: encryptToken(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshTokenExpiresAt: tokens.x_refresh_token_expires_in
          ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000)
          : null,
        lastError: null,
      },
    });

    return redirect(request, "quickbooks-connected");
  } catch (callbackError) {
    console.error("QuickBooks callback failed", callbackError);
    return redirect(request, "quickbooks-error");
  }
}
