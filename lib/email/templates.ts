import "server-only"
import type { OrderItem, OrderWithItems } from "@/lib/orders/types"

/**
 * Render-side helpers for transactional order emails.
 *
 * We hand-roll inline-styled HTML instead of using react-email because the
 * project doesn't need the dependency and these are simple, mostly-text
 * messages. Keep edits minimal and accessible.
 *
 * NOTE on price formatting: each currency is rendered with es-AR locale and
 * no decimals to match the storefront. Adjust if the currency demands it.
 */

interface RenderContext {
  /** Public-facing tenant name (e.g. "Viditas"). */
  tenantName: string
  /** Optional storefront URL we link in the footer (without trailing slash). */
  storefrontUrl?: string
  /** Optional public order URL where the customer can review status. */
  orderUrl?: string
}

interface OrderEmail {
  subject: string
  html: string
  text: string
}

function fmtPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function variantSummary(it: OrderItem): string {
  const attrs = Object.entries(it.variant_attrs ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")
  return [it.variant_sku, attrs].filter(Boolean).join(" — ")
}

function itemsTableHtml(order: OrderWithItems): string {
  const rows = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee">
          <div style="font-weight:600;color:#111">${escapeHtml(it.product_name)}</div>
          ${
            variantSummary(it)
              ? `<div style="font-size:12px;color:#666;margin-top:2px">${escapeHtml(variantSummary(it))}</div>`
              : ""
          }
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center;color:#444">×${it.qty}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums;color:#111">${escapeHtml(
          fmtPrice(Number(it.line_total), order.currency),
        )}</td>
      </tr>`,
    )
    .join("")

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0">
      ${rows}
      <tr>
        <td colspan="2" style="padding:16px 0 0;font-weight:600;color:#111">Total</td>
        <td style="padding:16px 0 0;text-align:right;font-weight:700;color:#111;font-variant-numeric:tabular-nums">
          ${escapeHtml(fmtPrice(Number(order.total), order.currency))}
        </td>
      </tr>
    </table>`
}

function itemsListText(order: OrderWithItems): string {
  return order.items
    .map(
      (it) =>
        `- ${it.product_name}${variantSummary(it) ? ` (${variantSummary(it)})` : ""} x${it.qty} — ${fmtPrice(
          Number(it.line_total),
          order.currency,
        )}`,
    )
    .join("\n")
}

function shell(opts: {
  preheader: string
  heading: string
  intro: string
  bodyHtml: string
  ctaUrl?: string
  ctaLabel?: string
  ctx: RenderContext
}): string {
  const cta = opts.ctaUrl
    ? `<p style="margin:24px 0">
         <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(
           opts.ctaLabel ?? "Ver pedido",
         )}</a>
       </p>`
    : ""
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(
    opts.heading,
  )}</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222">
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #ececec;border-radius:12px;overflow:hidden">
      <tr><td style="padding:28px 32px 8px">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(opts.ctx.tenantName)}</div>
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#111">${escapeHtml(opts.heading)}</h1>
      </td></tr>
      <tr><td style="padding:8px 32px 0;font-size:14px;line-height:1.6;color:#333">
        <p style="margin:12px 0">${opts.intro}</p>
        ${opts.bodyHtml}
        ${cta}
      </td></tr>
      <tr><td style="padding:24px 32px 28px;font-size:11px;color:#999;border-top:1px solid #f0f0f0;margin-top:16px">
        ${opts.ctx.storefrontUrl ? `Visitá <a href="${escapeHtml(opts.ctx.storefrontUrl)}" style="color:#666">${escapeHtml(opts.ctx.storefrontUrl.replace(/^https?:\/\//, ""))}</a>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export type OrderEvent =
  | "received"
  | "confirmed"
  | "fulfilled"
  | "cancelled"
  | "tenant_notification"

export function renderOrderEmail(
  event: OrderEvent,
  order: OrderWithItems,
  ctx: RenderContext,
): OrderEmail {
  const code = order.code
  const total = fmtPrice(Number(order.total), order.currency)
  const itemsHtml = itemsTableHtml(order)
  const itemsTxt = itemsListText(order)

  switch (event) {
    case "received":
      return {
        subject: `Recibimos tu pedido ${code}`,
        html: shell({
          preheader: `Tu pedido ${code} fue registrado y lo estamos preparando.`,
          heading: `Recibimos tu pedido ${escapeHtml(code)}`,
          intro: `Hola ${escapeHtml(order.customer_name)}, gracias por tu compra. Te confirmamos que recibimos tu pedido y lo estamos revisando. Te avisamos en cuanto lo confirmemos.`,
          bodyHtml: itemsHtml,
          ctaUrl: ctx.orderUrl,
          ctaLabel: "Ver mi pedido",
          ctx,
        }),
        text: `Hola ${order.customer_name},\n\nRecibimos tu pedido ${code} y lo estamos revisando.\n\n${itemsTxt}\n\nTotal: ${total}\n\n${ctx.orderUrl ?? ""}`,
      }

    case "confirmed":
      return {
        subject: `Tu pedido ${code} está confirmado`,
        html: shell({
          preheader: `Confirmamos tu pedido ${code}. ¡Ya lo estamos preparando!`,
          heading: `Pedido ${escapeHtml(code)} confirmado`,
          intro: `Buenas noticias, ${escapeHtml(order.customer_name)}: confirmamos tu pedido y ya lo estamos preparando para enviártelo.`,
          bodyHtml: itemsHtml,
          ctaUrl: ctx.orderUrl,
          ctaLabel: "Ver mi pedido",
          ctx,
        }),
        text: `Hola ${order.customer_name},\n\nTu pedido ${code} está confirmado y lo estamos preparando.\n\n${itemsTxt}\n\nTotal: ${total}`,
      }

    case "fulfilled":
      return {
        subject: `Tu pedido ${code} fue entregado`,
        html: shell({
          preheader: `Pedido ${code} entregado. ¡Gracias por elegirnos!`,
          heading: `Pedido ${escapeHtml(code)} entregado`,
          intro: `Listo, ${escapeHtml(order.customer_name)}. Tu pedido fue marcado como entregado. Esperamos que disfrutes tu compra. Si querés contarnos cómo te fue, respondé este mail.`,
          bodyHtml: itemsHtml,
          ctx,
        }),
        text: `Hola ${order.customer_name},\n\nTu pedido ${code} fue entregado. ¡Gracias por elegirnos!\n\n${itemsTxt}`,
      }

    case "cancelled":
      return {
        subject: `Tu pedido ${code} fue cancelado`,
        html: shell({
          preheader: `Cancelamos tu pedido ${code}. Si no fuiste vos, escribinos.`,
          heading: `Pedido ${escapeHtml(code)} cancelado`,
          intro: `Hola ${escapeHtml(order.customer_name)}, te avisamos que tu pedido fue cancelado. Si pensás que fue un error o querés volver a comprar, respondé este mail y lo resolvemos.`,
          bodyHtml: itemsHtml,
          ctx,
        }),
        text: `Hola ${order.customer_name},\n\nTu pedido ${code} fue cancelado.\n\n${itemsTxt}`,
      }

    case "tenant_notification":
      return {
        subject: `Nuevo pedido ${code} — ${total}`,
        html: shell({
          preheader: `Pedido nuevo de ${order.customer_name} en ${ctx.tenantName}.`,
          heading: `Nuevo pedido en ${escapeHtml(ctx.tenantName)}`,
          intro: `Acaba de entrar el pedido <b>${escapeHtml(code)}</b> de <b>${escapeHtml(order.customer_name)}</b> (${escapeHtml(order.customer_email)}${order.customer_phone ? `, ${escapeHtml(order.customer_phone)}` : ""}). Revisalo y confirmalo desde el panel.`,
          bodyHtml: itemsHtml,
          ctaUrl: ctx.orderUrl,
          ctaLabel: "Abrir pedido",
          ctx,
        }),
        text: `Nuevo pedido ${code} de ${order.customer_name} (${order.customer_email}).\n\n${itemsTxt}\n\nTotal: ${total}`,
      }
  }
}
