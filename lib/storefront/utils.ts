import type { ProductVariant } from "@/lib/products/types"
import type { StorefrontConfig } from "./types"

const DEFAULT_TEMPLATE = "Hola! Me interesa {product}. {url}"

/** Build a wa.me URL with a pre-filled message. Returns null if no number. */
export function buildWhatsappUrl(
  config: StorefrontConfig,
  context: { product: string; url: string },
): string | null {
  if (!config.whatsapp) return null
  const tpl = (config.whatsapp_template?.trim() || DEFAULT_TEMPLATE).slice(0, 600)
  const message = tpl.replace("{product}", context.product).replace("{url}", context.url)
  // Strip non-digits except leading + (wa.me wants no +)
  const number = config.whatsapp.replace(/[^\d]/g, "")
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

/**
 * Format a price using `Intl.NumberFormat` for the storefront's currency.
 * Falls back to "—" when the value is null/undefined.
 */
export function formatPrice(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—"
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

/**
 * Pick a variant given a partial selection of attribute key/value pairs.
 * Returns null if no exact match exists.
 */
export function findVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | null {
  const keys = Object.keys(selection)
  if (keys.length === 0) return null
  return (
    variants.find((v) =>
      keys.every((k) => (v.attributes ?? {})[k] === selection[k]),
    ) ?? null
  )
}

/**
 * Return the unique values used across a set of variants for each variant
 * attribute key, preserving the order they first appear.
 */
export function variantOptionsFromVariants(
  variants: ProductVariant[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const v of variants) {
    for (const [k, val] of Object.entries(v.attributes ?? {})) {
      if (typeof val !== "string") continue
      if (!result[k]) result[k] = []
      if (!result[k].includes(val)) result[k].push(val)
    }
  }
  return result
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

export function clampString(value: string | undefined, max: number): string | undefined {
  if (!value) return value
  return value.length > max ? value.slice(0, max) : value
}
