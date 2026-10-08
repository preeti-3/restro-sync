import type { RestaurantRole } from "@/types";

export const can = {
  manageMenu: (role: RestaurantRole) => role === "OWNER" || role === "ADMIN",
  manageStaff: (role: RestaurantRole) => role === "OWNER",
  createOrder: (role: RestaurantRole) => ["OWNER", "ADMIN", "CASHIER"].includes(role),
  updateKitchen: (role: RestaurantRole) => ["OWNER", "ADMIN", "KITCHEN"].includes(role),
  viewReports: (role: RestaurantRole) => role === "OWNER" || role === "ADMIN",
};
