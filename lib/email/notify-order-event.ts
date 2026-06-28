import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import type { OrderWithItems, OrderItem, Order } from "@/lib/orders/types"
import type { StorefrontConfig } from "@/lib/storefront/types"
import { getResend, isEmailConfigured } from "./client"
import { renderOrderEmail, type OrderEvent } from "./templates"

/**
 * Dispatch a transactional email for an order event.
 *
 * Behaviors:
 *   - If `RESEND_API_KEY` is not set, we log and return silently (dev/preview).
 *   - If the tenant has no `from_email` set, we skip customer-facing emails
 *     because we have no verified sender. We still try the tenant
 *     notification using `from_email` (which may also be missing — then we skip).
 *   - Errors never bubble up: they're logged and swallowed so the order
 *     flow is not blocked by an email failure.
 *
 * `event` decides who is the recipient:
 *   - "received" / "confirmed" / "fulfilled" / "cancelled" -> customer
 *   - "tenant_notification" -> tenant inbox (notification_email)
 */
export async function notifyOrderEvent(
  orderId: string,
  event: OrderEvent,
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      console.log("[sc] email skip (no RESEND_API_KEY):", event, orderId)
      return
    }

    const supabase = createServiceClient()
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle<Order>()
    if (!order) return

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true })
      .returns<OrderItem[]>()

    const orderWithItems: OrderWithItems = { ...order, items: items ?? [] }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug, storefront_config")
      .eq("id", order.tenant_id)
      .maybeSingle()
    if (!tenant) return

    const config = (tenant.storefront_config ?? {}) as StorefrontConfig
    const from = config.from_email?.trim()
    if (!from) {
      console.log("[sc] email skip (no from_email):", tenant.slug, event)
      return
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const storefrontUrl = baseUrl ? `${baseUrl}/s/${tenant.slug}` : undefined
    const orderUrl =
      event === "tenant_notification"
        ? baseUrl
          ? `${baseUrl}/app/${tenant.slug}/orders/${order.id}`
          : undefined
        : storefrontUrl
          ? `${storefrontUrl}/orders/${order.code}`
          : undefined

    const rendered = renderOrderEmail(event, orderWithItems, {
      tenantName: tenant.name,
      storefrontUrl,
      orderUrl,
    })

    const to =
      event === "tenant_notification"
        ? config.notification_email?.trim()
        : order.customer_email

    if (!to) {
      console.log("[sc] email skip (no recipient):", event, orderId)
      return
    }

    const resend = getResend()
    if (!resend) return

    const { error } = await resend.emails.send({
      from,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: config.email || undefined,
    })

    if (error) {
      console.log("[sc] email send error:", event, error.message)
    } else {
      console.log("[sc] email sent:", event, orderId, "→", to)
    }
  } catch (e) {
    // Never let email errors break the calling flow.
    console.log(
      "[sc] notifyOrderEvent crash:",
      event,
      orderId,
      e instanceof Error ? e.message : String(e),
    )
  }
}
