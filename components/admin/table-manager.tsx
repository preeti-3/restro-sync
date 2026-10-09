/* QR codes are generated data URLs and must remain exact; Next image optimization is intentionally bypassed. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2, Power, Printer, QrCode, Users, XCircle } from "lucide-react";
import { saveTable } from "@/app/actions/admin";
import { closeTableVisit } from "@/app/actions/orders";
import { deactivateTableQr, generateTableQr } from "@/app/actions/table-qr";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label } from "@/components/ui/primitives";
import type { RestaurantTable } from "@/types";

type PrintableQr = { tableName: string; dataUrl: string; orderUrl: string };

export function TableManager({ tables }: { tables: RestaurantTable[] }) {
  const [state, action, pending] = useActionState(saveTable, {});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [printable, setPrintable] = useState<PrintableQr | null>(null);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const savedCodes = tables.flatMap((table) => {
      const qr = table.table_qr_codes?.find((item) => item.active && item.order_url);
      return qr?.order_url ? [{ tableId: table.id, url: qr.order_url }] : [];
    });

    Promise.all(savedCodes.map(async ({ tableId, url }) => [
      tableId,
      await QRCode.toDataURL(url, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#173b31", light: "#ffffff" },
      }),
    ] as const)).then((entries) => {
      if (!cancelled) setQrImages(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [tables]);

  async function generate(table: RestaurantTable) {
    setWorkingId(table.id);
    const result = await generateTableQr(table.id);
    if (result.url) {
      const dataUrl = await QRCode.toDataURL(result.url, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#173b31", light: "#ffffff" },
      });
      setPrintable({ tableName: table.name, dataUrl, orderUrl: result.url });
    } else alert(result.error);
    setWorkingId(null);
  }

  function viewSaved(table: RestaurantTable, orderUrl: string) {
    const dataUrl = qrImages[table.id];
    if (dataUrl) setPrintable({ tableName: table.name, dataUrl, orderUrl });
  }

  async function deactivate(tableId: string) {
    if (!confirm("Deactivate this table QR? Existing scans will stop opening the menu.")) return;
    setWorkingId(tableId);
    const result = await deactivateTableQr(tableId);
    if (result.error) alert(result.error);
    setPrintable(null);
    setWorkingId(null);
  }

  async function closeVisit(tableId: string) {
    if (!confirm("Close this table visit? New scans will start a fresh visit and cannot see prior guests' orders.")) return;
    setWorkingId(tableId);
    const result = await closeTableVisit(tableId);
    if (result.error) alert(result.error);
    setWorkingId(null);
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="font-display font-semibold">Add a table</h2>
          <form action={action} className="mt-4 space-y-4">
            <div><Label htmlFor="table-name">Table name / number</Label><Input id="table-name" name="name" required placeholder="T-01" /></div>
            <div><Label htmlFor="capacity">Capacity</Label><Input id="capacity" name="capacity" type="number" defaultValue="4" min="1" max="50" /></div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked />Active</label>
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />}Add table</Button>
          </form>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => {
            const activeQr = table.table_qr_codes?.find((qr) => qr.active);
            const savedUrl = activeQr?.order_url;
            const savedImage = qrImages[table.id];
            const openVisit = table.table_visits?.find((visit) => visit.status === "OPEN");

            return (
              <Card key={table.id} className="overflow-hidden p-5">
                <div className="flex items-start justify-between">
                  <div><h3 className="font-display text-lg font-bold">{table.name}</h3><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" />{table.capacity} seats</p></div>
                  <Badge tone={table.status === "AVAILABLE" ? "success" : table.status === "BILLING" ? "warning" : "info"}>{table.status}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><Badge tone={activeQr ? "success" : "neutral"}>{activeQr ? "QR active" : "No active QR"}</Badge>{openVisit && <Badge tone="info">Visit open</Badge>}</div>

                {savedUrl && (
                  <button type="button" onClick={() => viewSaved(table, savedUrl)} disabled={!savedImage} className="mt-4 flex w-full flex-col items-center rounded-2xl border border-orange-100 bg-orange-50/60 p-3 transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:cursor-wait">
                    {savedImage ? <img src={savedImage} alt={`Saved ordering QR code for ${table.name}`} className="aspect-square w-36 rounded-xl bg-white" /> : <span className="grid h-36 w-36 place-items-center rounded-xl bg-white"><Loader2 className="animate-spin text-primary" /></span>}
                    <span className="mt-2 text-sm font-bold text-primary">View, print or download</span>
                  </button>
                )}

                <div className="mt-4 grid gap-2">
                  {!savedUrl && <Button variant="outline" onClick={() => generate(table)} disabled={workingId === table.id}>{workingId === table.id ? <Loader2 className="animate-spin" /> : <QrCode />}{activeQr ? "Replace legacy QR once" : "Generate QR"}</Button>}
                  {activeQr && <Button variant="ghost" onClick={() => deactivate(table.id)}><Power />Deactivate QR</Button>}
                  {openVisit && <Button variant="destructive" onClick={() => closeVisit(table.id)}><XCircle />Close table visit</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {printable && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={`QR code for ${printable.tableName}`}>
          <Card className="w-full max-w-sm p-6 text-center">
            <p className="text-sm font-semibold text-primary">Customer ordering</p><h2 className="mt-1 font-display text-2xl font-bold">{printable.tableName}</h2>
            <img src={printable.dataUrl} alt={`Ordering QR code for ${printable.tableName}`} className="mx-auto my-4 aspect-square w-full max-w-64" />
            <p className="break-all text-xs text-muted-foreground">{printable.orderUrl}</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><Button asChild variant="outline"><a href={printable.dataUrl} download={`restrosync-${printable.tableName}-qr.png`}><Download />Download</a></Button><Button onClick={() => window.print()}><Printer />Print</Button></div>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setPrintable(null)}>Close</Button>
          </Card>
        </div>
      )}

      <div id="table-qr-print" className="hidden print:block">
        {printable && <div className="p-6 text-center"><h1 className="text-3xl font-bold">Scan to order</h1><p className="mt-2 text-xl">You&apos;re ordering at {printable.tableName}</p><img src={printable.dataUrl} alt="" className="mx-auto mt-6 w-[70mm]" /><p className="mt-4">Open your camera and scan the QR code</p></div>}
      </div>
    </>
  );
}
