import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GUEST_COOKIE, getGuestContext, hashOpaqueToken, newOpaqueToken } from "@/lib/guest/session";

export async function GET(request: NextRequest) {
  const tableToken = request.nextUrl.searchParams.get("table") ?? "";
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(tableToken)) return NextResponse.redirect(new URL("/order/invalid", request.url));
  const existing = await getGuestContext(tableToken, true);
  if (existing) return NextResponse.redirect(new URL(`/order/${tableToken}?ready=1`, request.url));
  const sessionToken = newOpaqueToken();
  const admin = createAdminClient();
  const { error } = await admin.rpc("open_guest_session", { p_qr_hash: hashOpaqueToken(tableToken), p_session_hash: hashOpaqueToken(sessionToken) });
  if (error) return NextResponse.redirect(new URL("/order/invalid?reason=This+QR+code+is+invalid+or+inactive.", request.url));
  const response = NextResponse.redirect(new URL(`/order/${tableToken}?ready=1`, request.url));
  response.cookies.set(GUEST_COOKIE, sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
