import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeDestination(request: NextRequest, raw: string | null, type: EmailOtpType) {
  if (type !== "invite") return "/";
  if (!raw) return "/login";
  try {
    const target = new URL(raw, request.nextUrl.origin);
    if (target.origin !== request.nextUrl.origin) return "/login";
    return /^\/invite\/[A-Za-z0-9_-]{32,200}$/.test(target.pathname) ? target.pathname : "/login";
  } catch {
    return "/login";
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(safeDestination(request, request.nextUrl.searchParams.get("next"), type), request.url));
  }

  const failure = new URL("/login", request.url);
  failure.searchParams.set("error", "This email link is invalid or has expired. Request a new one.");
  return NextResponse.redirect(failure);
}
