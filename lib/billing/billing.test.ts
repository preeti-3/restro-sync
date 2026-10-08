import { describe, expect, it } from "vitest";
import { calculateBill } from ".";

describe("calculateBill", () => {
  it("calculates subtotal and add-ons in integer paise", () => expect(calculateBill({ lines: [{ unitPricePaise: 10_050, addonTotalPaise: 500, quantity: 2 }] }).subtotalPaise).toBe(21_100));
  it("applies a fixed discount", () => expect(calculateBill({ lines: [{ unitPricePaise: 10_000, quantity: 1 }], discountType: "FIXED", discountValue: 1200 }).totalPaise).toBe(8800));
  it("applies percentage discount in basis points", () => expect(calculateBill({ lines: [{ unitPricePaise: 10_000, quantity: 1 }], discountType: "PERCENTAGE", discountValue: 1250 }).discountPaise).toBe(1250));
  it("calculates tax and service charge after discount", () => expect(calculateBill({ lines: [{ unitPricePaise: 10_000, quantity: 1 }], discountType: "FIXED", discountValue: 1000, taxBasisPoints: 500, serviceChargeBasisPoints: 1000 })).toMatchObject({ taxPaise: 450, serviceChargePaise: 900, totalPaise: 10_350 }));
  it("rounds half paise to the nearest paise", () => expect(calculateBill({ lines: [{ unitPricePaise: 101, quantity: 1 }], taxBasisPoints: 500 }).taxPaise).toBe(5));
  it("never discounts below zero", () => expect(calculateBill({ lines: [{ unitPricePaise: 100, quantity: 1 }], discountType: "FIXED", discountValue: 500 }).totalPaise).toBe(0));
});
