import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./transitions";

describe("order transitions", () => {
  it("allows the expected happy path", () => { expect(canTransition("DRAFT", "CONFIRMED")).toBe(true); expect(canTransition("CONFIRMED", "PREPARING")).toBe(true); expect(canTransition("PREPARING", "READY")).toBe(true); expect(canTransition("READY", "SERVED")).toBe(true); expect(canTransition("SERVED", "COMPLETED")).toBe(true); });
  it("prevents edits after completion or cancellation", () => { expect(canTransition("COMPLETED", "CONFIRMED")).toBe(false); expect(canTransition("CANCELLED", "DRAFT")).toBe(false); expect(() => assertTransition("COMPLETED", "CANCELLED")).toThrow(); });
});
