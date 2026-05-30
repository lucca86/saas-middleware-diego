import "server-only"

/**
 * WooCommerce export: Stockcurve → WooCommerce.
 *
 * Strategy per product:
 *   - No mapping  → POST /products (creates simple or variable product + variations)
 *   - Has mapping → PATCH price / stock / status on product + each variant
 *
 * Handles:
 *   - Simple products (single variant, no attributes)
 *   - Variable products (multiple variants with attribute combinations)
 *   - Images: sent as { src } array on create; updated on PUT
 *   - Stock: sets manage_stock + stock_quantity on each variant (or product if simple)
 *   - Prices: regular_price on each variant
 */

import { createServiceClient } from "@/lib/supabase/service"
import { writeSyncLogPush } from "./sync-log"
import {
  updateWooProduct,
  updateWooVariation,
} from "./woocommerce"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WooExportProgress {
  type: "progress" | "log" | "done" | "error"
  current?: number
  total?: number
  productName?: string
  action?: "created" | "updated" | "skipped" | "failed"
  message?: string
  level?: "info" | "warn" | "error"
  summary?: WooExportSummary
  error?: string
}

export interface WooExportSummary {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Call WC REST API directly (POST/PUT) using stored credentials. */
async function wcFetch(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): Promise<unknown> {
  const base = storeUrl.replace(/\/+$/, "")
  const url = `${base}/wp-json/wc/v3${path}`
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      "User-Agent": "Mozilla/5.0 (compatible; Stockcurve/1.0; +https://stockcurve.com) AppleWebKit/537.36",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let msg = `WooCommerce ${res.status}`
    try {
      const j = JSON.parse(text)
      if (j?.message) msg += `: ${j.message}`
    } catch {
      if (text) msg += `: ${text.slice(0, 300)}`
    }
    throw new Error(msg)
  }
  return res.json()
}

/** Convert SC variant attributes { Color: ["Rojo"] | "Rojo" } → WC attribute array. */
function scAttrsToWoo(
  attrs: Record<string, unknown> | null,
): Array<{ name: string; option: string }> {
  if (!attrs || typeof attrs !== "object") return []
  return Object.entries(attrs).flatMap(([name, raw]) => {
    const opts: string[] = Array.isArray(raw)
      ? (raw as unknown[]).map(String)
      : raw != null
        ? [String(raw)]
        : []
    return opts.map((option) => ({ name, option }))
  })
}

/** Build the global attribute list for a variable product from all its variants. */
function buildProductAttributes(
  variants: Array<{ attributes: Record<string, unknown> | null }>,
): Array<{ name: string; variation: boolean; visible: boolean; options: string[] }> {
  const map = new Map<string, Set<string>>()
  for (const v of variants) {
    if (!v.attributes || typeof v.attributes !== "object") continue
    for (const [name, raw] of Object.entries(v.attributes)) {
      // opts may be a string[], a string, or anything — normalise to string[]
      const opts: string[] = Array.isArray(raw)
        ? (raw as unknown[]).map(String)
        : raw != null
          ? [String(raw)]
          : []
      if (opts.length === 0) continue
      if (!map.has(name)) map.set(name, new Set())
      for (const o of opts) map.get(name)!.add(o)
    }
  }
  return Array.from(map.entries()).map(([name, opts]) => ({
    name,
    variation: true,
    visible: true,
    options: Array.from(opts),
  }))
}

// ─── Main export runner ────────────────────────────────────────────────────────

export async function* runWooExport(opts: {
  tenantId: string
  channelId: string
}): AsyncGenerator<WooExportProgress> {
  const { tenantId, channelId } = opts
  const service = createServiceClient()

  // ── Load channel credentials ──────────────────────────────────────────────
  const { data: channel } = await service
    .from("sales_channels")
    .select("store_url, access_token, refresh_token, currency, metadata")
    .eq("id", channelId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (!channel?.store_url || !channel.access_token || !channel.refresh_token) {
    yield { type: "error", error: "Canal WooCommerce sin credenciales. Reconectá el canal." }
    return
  }

  const storeUrl = channel.store_url as string
  const consumerKey = channel.access_token as string
  const consumerSecret = channel.refresh_token as string
  const meta = (channel.metadata ?? {}) as Record<string, unknown>

  // ── Load products ─────────────────────────────────────────────────────────
  const { data: products, error: prodErr } = await service
    .from("products")
    .select(`
      id, name, description, status, sku,
      product_variants ( id, sku, price, compare_at_price, stock, status, attributes ),
      product_images   ( url, position, is_primary, alt )
    `)
    .eq("tenant_id", tenantId)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: true })

  if (prodErr || !products?.length) {
    yield {
      type: "done",
      summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] },
    }
    return
  }

  const summary: WooExportSummary = {
    total: products.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // ── Load existing mappings ────────────────────────────────────────────────
  const { data: mappings } = await service
    .from("channel_product_mappings")
    .select("product_id, variant_id, external_product_id, external_variant_id")
    .eq("channel_id", channelId)

  // product_id → wc product id (numeric string)
  const productMap = new Map<string, string>()
  // variant_id  → wc variation id (numeric string)
  const variantMap = new Map<string, string>()

  for (const m of mappings ?? []) {
    if (m.product_id && m.external_product_id) {
      productMap.set(m.product_id, m.external_product_id)
    }
    if (m.variant_id && m.external_variant_id) {
      variantMap.set(m.variant_id, m.external_variant_id)
    }
  }

  // ── Process each product ──────────────────────────────────────────────────
  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const productName = (product.name as string) ?? "Producto"

    yield { type: "progress", current: i + 1, total: products.length, productName }

    type Variant = {
      id: string
      sku: string | null
      price: number
      compare_at_price: number | null
      stock: number | null
      status: string
      attributes: Record<string, string[]> | null
    }

    const variants = (product.product_variants ?? []) as Variant[]
    const activeVariants = variants.filter((v) => v.status === "active")
    const workingVariants = activeVariants.length > 0 ? activeVariants : variants

    if (workingVariants.length === 0) {
      summary.skipped++
      yield { type: "progress", current: i + 1, total: products.length, productName, action: "skipped" }
      yield { type: "log", message: `${productName}: sin variantes activas, omitido.`, level: "warn" }
      continue
    }

    const images = ((product.product_images ?? []) as Array<{
      url: string; position: number; is_primary: boolean; alt: string | null
    }>)
      .filter((img) => img.url)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

    const isVariable = workingVariants.length > 1 ||
      workingVariants.some((v) => v.attributes && Object.keys(v.attributes).length > 0)

    const existingWcId = productMap.get(product.id)

    try {
      if (existingWcId) {
        // ── UPDATE ────────────────────────────────────────────────────────────
        const wcProductId = Number(existingWcId)

        // Update product-level fields
        const productUpdate: Record<string, unknown> = {
          name: productName,
          status: product.status === "active" ? "publish" : "draft",
          ...(product.description ? { description: product.description as string } : {}),
          ...(images.length > 0 ? { images: images.slice(0, 8).map((img) => ({ src: img.url, alt: img.alt ?? "" })) } : {}),
        }
        await wcFetch(storeUrl, consumerKey, consumerSecret, `/products/${wcProductId}`, "PUT", productUpdate)
        yield { type: "log", message: `${productName}: producto base actualizado en WC #${wcProductId}`, level: "info" }

        // Update each variant
        for (const v of workingVariants) {
          const wcVarId = variantMap.get(v.id)
          if (!wcVarId) {
            yield { type: "log", message: `${productName}: variante ${v.sku ?? v.id} sin mapeo WC — se omite actualización.`, level: "warn" }
            continue
          }

          const varUpdate: Record<string, unknown> = {
            price: String(v.price),
            regular_price: String(v.compare_at_price ?? v.price),
            sale_price: v.compare_at_price ? String(v.price) : "",
            manage_stock: true,
            stock_quantity: Math.max(0, v.stock ?? 0),
            stock_status: (v.stock ?? 0) > 0 ? "instock" : "outofstock",
            ...(v.sku ? { sku: v.sku } : {}),
          }

          if (isVariable) {
            await wcFetch(
              storeUrl, consumerKey, consumerSecret,
              `/products/${wcProductId}/variations/${wcVarId}`,
              "PUT",
              varUpdate,
            )
          } else {
            // Simple product — update at product level
            await wcFetch(storeUrl, consumerKey, consumerSecret, `/products/${wcProductId}`, "PUT", varUpdate)
          }
        }

        summary.updated++
        yield { type: "progress", current: i + 1, total: products.length, productName, action: "updated" }

        void writeSyncLogPush({
          tenantId, channelId,
          eventType: "push_product",
          status: "ok",
          summary: `WC actualizado: ${productName} (#${wcProductId})`,
          productId: product.id,
        })
      } else {
        // ── CREATE ────────────────────────────────────────────────────────────
        const mainVariant = workingVariants[0]

        const basePayload: Record<string, unknown> = {
          name: productName,
          status: product.status === "active" ? "publish" : "draft",
          type: isVariable ? "variable" : "simple",
          ...(product.description ? { description: product.description as string } : {}),
          ...(product.sku ? { sku: product.sku as string } : {}),
          ...(images.length > 0
            ? { images: images.slice(0, 8).map((img) => ({ src: img.url, alt: img.alt ?? "" })) }
            : {}),
        }

        if (!isVariable) {
          // Simple product — price & stock directly on the product
          Object.assign(basePayload, {
            regular_price: String(mainVariant.compare_at_price ?? mainVariant.price),
            price: String(mainVariant.price),
            sale_price: mainVariant.compare_at_price ? String(mainVariant.price) : "",
            manage_stock: true,
            stock_quantity: Math.max(0, mainVariant.stock ?? 0),
            stock_status: (mainVariant.stock ?? 0) > 0 ? "instock" : "outofstock",
            ...(mainVariant.sku ? { sku: mainVariant.sku } : {}),
          })
        } else {
          // Variable product — define global attributes so WC knows the axes
          basePayload.attributes = buildProductAttributes(workingVariants)
        }

        const created = await wcFetch(
          storeUrl, consumerKey, consumerSecret, "/products", "POST", basePayload,
        ) as { id: number }

        const wcProductId = created.id
        yield { type: "log", message: `${productName}: creado en WC como #${wcProductId}`, level: "info" }

        // Save product-level mapping
        await service.from("channel_product_mappings").upsert(
          {
            channel_id: channelId,
            product_id: product.id,
            variant_id: mainVariant.id,
            external_product_id: String(wcProductId),
            external_variant_id: null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "channel_id,product_id,variant_id" },
        )
        productMap.set(product.id, String(wcProductId))

        // Create variations for variable products
        if (isVariable) {
          for (const v of workingVariants) {
            const varPayload: Record<string, unknown> = {
              regular_price: String(v.compare_at_price ?? v.price),
              price: String(v.price),
              sale_price: v.compare_at_price ? String(v.price) : "",
              manage_stock: true,
              stock_quantity: Math.max(0, v.stock ?? 0),
              stock_status: (v.stock ?? 0) > 0 ? "instock" : "outofstock",
              attributes: scAttrsToWoo(v.attributes),
              ...(v.sku ? { sku: v.sku } : {}),
            }

            const createdVar = await wcFetch(
              storeUrl, consumerKey, consumerSecret,
              `/products/${wcProductId}/variations`,
              "POST",
              varPayload,
            ) as { id: number }

            yield { type: "log", message: `  variante ${v.sku ?? v.id} → WC variation #${createdVar.id}`, level: "info" }

            // Save variant mapping
            await service.from("channel_product_mappings").upsert(
              {
                channel_id: channelId,
                product_id: product.id,
                variant_id: v.id,
                external_product_id: String(wcProductId),
                external_variant_id: String(createdVar.id),
                synced_at: new Date().toISOString(),
              },
              { onConflict: "channel_id,product_id,variant_id" },
            )
            variantMap.set(v.id, String(createdVar.id))
          }
        }

        summary.created++
        yield { type: "progress", current: i + 1, total: products.length, productName, action: "created" }

        void writeSyncLogPush({
          tenantId, channelId,
          eventType: "push_product",
          status: "ok",
          summary: `WC creado: ${productName} (#${wcProductId})`,
          productId: product.id,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      summary.failed++
      summary.errors.push(`${productName}: ${message}`)
      yield { type: "progress", current: i + 1, total: products.length, productName, action: "failed" }
      yield { type: "log", message: `ERROR ${productName}: ${message}`, level: "error" }

      void writeSyncLogPush({
        tenantId, channelId,
        eventType: "push_product",
        status: "error",
        summary: `WC error ${productName}: ${message}`,
        productId: product.id,
      })
    }
  }

  // ── Persist summary ───────────────────────────────────────────────────────
  await service
    .from("sales_channels")
    .update({
      last_synced_at: new Date().toISOString(),
      metadata: {
        ...meta,
        last_export: new Date().toISOString(),
        last_export_summary: summary,
      },
    })
    .eq("id", channelId)

  void writeSyncLogPush({
    tenantId, channelId,
    eventType: "push_product",
    status: summary.failed > 0 ? (summary.created + summary.updated > 0 ? "partial" : "error") : "ok",
    summary: `WC export: ${summary.created} creados, ${summary.updated} actualizados, ${summary.skipped} omitidos, ${summary.failed} fallaron de ${summary.total}.`,
  })

  yield { type: "done", summary }
}
