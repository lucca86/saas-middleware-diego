export type OrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled"

export interface Order {
  id: string
  tenant_id: string
  code: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_notes: string | null
  currency: string
  subtotal: number
  total: number
  status: OrderStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  tenant_id: string
  product_id: string | null
  variant_id: string | null
  product_name: string
  variant_sku: string | null
  variant_attrs: Record<string, string>
  unit_price: number
  qty: number
  line_total: number
  created_at: string
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  fulfilled: "Entregado",
  cancelled: "Cancelado",
}
