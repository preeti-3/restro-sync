export interface BillInput { lines: { unitPricePaise: number; quantity: number; addonTotalPaise?: number }[]; discountType?: "NONE" | "FIXED" | "PERCENTAGE"; discountValue?: number; taxBasisPoints?: number; serviceChargeBasisPoints?: number }
export interface Bill { subtotalPaise: number; discountPaise: number; taxablePaise: number; taxPaise: number; serviceChargePaise: number; totalPaise: number }

function percent(amount: number, basisPoints: number) { return Math.round((amount * basisPoints) / 10_000); }
export function calculateBill(input: BillInput): Bill {
  const subtotalPaise = input.lines.reduce((sum, line) => sum + (line.unitPricePaise + (line.addonTotalPaise ?? 0)) * line.quantity, 0);
  const rawDiscount = input.discountType === "FIXED" ? (input.discountValue ?? 0) : input.discountType === "PERCENTAGE" ? percent(subtotalPaise, Math.min(input.discountValue ?? 0, 10_000)) : 0;
  const discountPaise = Math.min(subtotalPaise, Math.max(0, rawDiscount));
  const taxablePaise = subtotalPaise - discountPaise;
  const taxPaise = percent(taxablePaise, input.taxBasisPoints ?? 0);
  const serviceChargePaise = percent(taxablePaise, input.serviceChargeBasisPoints ?? 0);
  return { subtotalPaise, discountPaise, taxablePaise, taxPaise, serviceChargePaise, totalPaise: taxablePaise + taxPaise + serviceChargePaise };
}
