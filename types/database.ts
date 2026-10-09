export type UserRole = "ADMIN" | "CASHIER" | "KITCHEN";
export type RestaurantRole = "OWNER" | "ADMIN" | "CASHIER" | "KITCHEN";
export type RestaurantStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type OrderStatus = "DRAFT" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
export type KotStatus = "NEW" | "PREPARING" | "READY";
export type TableStatus = "AVAILABLE" | "OCCUPIED" | "BILLING";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";
export type GuestOrderStatus = "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type GuestPaymentState = "PENDING" | "AWAITING_VERIFICATION" | "PAID" | "REJECTED";
export type OrderType = "DINE_IN" | "TAKEAWAY";
export type PaymentMethod = "CASH" | "UPI" | "CARD";
export type FoodType = "VEG" | "NON_VEG";

export interface Profile { id: string; full_name: string; role: UserRole; active: boolean; created_at: string }
export interface Restaurant { id: string; name: string; address: string; phone: string; email: string; status: RestaurantStatus; created_at: string; approved_at: string | null }
export interface RestaurantMembership { id: string; restaurant_id: string; user_id: string; role: RestaurantRole; active: boolean; restaurant: Restaurant }
export interface SessionProfile extends Profile { membership: RestaurantMembership; memberships: RestaurantMembership[]; is_platform_admin: boolean }
export interface Category { id: string; restaurant_id: string; name: string; sort_order: number; active: boolean }
export interface MenuVariant { id: string; name: string; price_delta_paise: number }
export interface Addon { id: string; name: string; price_paise: number; active: boolean }
export interface MenuItem { id: string; restaurant_id: string; category_id: string; name: string; description: string | null; price_paise: number; food_type: FoodType; available: boolean; active: boolean; menu_variants?: MenuVariant[]; addons?: Addon[] }
export interface RestaurantTable { id: string; restaurant_id: string; name: string; capacity: number; status: TableStatus; active: boolean; table_qr_codes?: { id: string; active: boolean; created_at: string; order_url: string | null }[]; table_visits?: { id: string; status: "OPEN" | "CLOSED"; started_at: string }[] }
export interface OrderItem { id: string; menu_item_id: string | null; item_name: string; unit_price_paise: number; quantity: number; variant_name: string | null; notes: string | null; line_total_paise: number; sent_to_kitchen: boolean; addons?: { name: string; price_paise: number }[] }
export interface Order { id: string; restaurant_id: string; order_number: string; order_type: OrderType; status: OrderStatus; table_id: string | null; customer_name: string | null; customer_phone: string | null; instructions: string | null; subtotal_paise: number; discount_paise: number; tax_paise: number; service_charge_paise: number; total_paise: number; payment_status: PaymentStatus; payment_method: PaymentMethod | null; cancellation_reason: string | null; created_at: string; source?: "STAFF" | "CUSTOMER_QR"; guest_status?: GuestOrderStatus | null; guest_payment_state?: GuestPaymentState; estimated_ready_at?: string | null; restaurant_tables?: Pick<RestaurantTable, "id" | "name"> | null; order_items?: OrderItem[]; guest_payment_claims?: GuestPaymentClaim[] }
export interface GuestPaymentClaim { id: string; order_id: string; amount_paise: number; transaction_reference: string | null; status: "AWAITING_VERIFICATION" | "VERIFIED" | "REJECTED"; verified_by: string | null; verified_at: string | null; rejection_reason: string | null; created_at: string }
export interface KotTicket { id: string; kot_number: string; order_id: string; status: KotStatus; created_at: string; order?: Pick<Order, "order_number" | "order_type" | "customer_name" | "source" | "guest_status" | "estimated_ready_at" | "created_at" | "instructions"> & { restaurant_tables?: Pick<RestaurantTable, "name"> | null }; kot_items?: { id: string; quantity: number; item_name: string; variant_name: string | null; notes: string | null; addons_text: string | null }[] }
