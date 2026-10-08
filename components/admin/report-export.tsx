"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ReportExport({ rows }: { rows: Record<string, unknown>[] }) { function download() { if (!rows.length) return; const headers = Object.keys(rows[0]); const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `restrosync-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); } return <Button variant="outline" onClick={download} disabled={!rows.length}><Download className="h-4 w-4"/>Export CSV</Button> }
