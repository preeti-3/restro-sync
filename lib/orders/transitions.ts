import type { OrderStatus } from "@/types";

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PREPARING", "READY", "CANCELLED"], PREPARING: ["READY", "CANCELLED"], READY: ["SERVED", "COMPLETED", "CANCELLED"], SERVED: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: []
};
export function canTransition(from: OrderStatus, to: OrderStatus) { return transitions[from].includes(to); }
export function assertTransition(from: OrderStatus, to: OrderStatus) { if (!canTransition(from, to)) throw new Error(`Invalid order transition: ${from} → ${to}`); }
