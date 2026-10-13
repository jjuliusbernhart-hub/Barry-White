import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getAuthorizationUrl,
  isQuickBooksConfigured,
} from "@/lib/quickbooks/client";

export async function GET(request: Request) {
  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(
      new URL("/?notice=quickbooks-not-configured", request.url),
    );
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(getAuthorizationUrl(state));
  response.cookies.set("qbo_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
