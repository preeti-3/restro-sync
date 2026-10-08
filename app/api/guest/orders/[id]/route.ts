import { NextRequest, NextResponse } from "next/server";
import { getOwnedGuestOrder } from "@/lib/guest/session";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tableToken = request.nextUrl.searchParams.get("table") ?? "";
  const owned = await getOwnedGuestOrder(tableToken, id);
  if (!owned) return NextResponse.json({ error: "Order not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(owned.order, { headers: { "Cache-Control": "no-store" } });
}
