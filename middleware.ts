import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  // With asymmetric signing keys this verifies locally instead of calling the
  // Auth server on every request. It still refreshes expired cookie sessions.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/invite/:path*",
    "/admin/:path*",
    "/cashier/:path*",
    "/kitchen/:path*",
    "/platform/:path*",
    "/onboarding/:path*",
    "/workspace/:path*",
  ],
};
