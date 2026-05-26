// v2
import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getMLAccessToken } from "@/lib/channels/mercadolibre"

export const runtime = "nodejs"

/**
 * GET /api/channels/mercadolibre/categories?channelId=...&q=...&siteId=MLA
 *
 * Searches ML categories by text using the ML categories/search API.
 * Falls back to fetching root categories if no query is provided.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")
  const q = url.searchParams.get("q") ?? ""
  const siteId = url.searchParams.get("siteId") ?? "MLA"

  if (!channelId) {
    return NextResponse.json({ error: "channelId requerido" }, { status: 400 })
  }

  try {
    const service = createServiceClient()
    const { data: channel } = await service
      .from("sales_channels")
      .select("id, tenant_id")
      .eq("id", channelId)
      .maybeSingle()

    if (!channel) return NextResponse.json({ error: "Canal no encontrado" }, { status: 404 })

    const token = await getMLAccessToken(channelId)

    let results: { id: string; name: string; path: string }[] = []

    if (q.trim().length > 1) {
      // Use ML's domain/search endpoint for category prediction
      const searchRes = await fetch(
        `https://api.mercadolibre.com/sites/${siteId}/domain_discovery/search?q=${encodeURIComponent(q)}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      )

      if (searchRes.ok) {
        const data = await searchRes.json() as Array<{
          category_id: string
          category_name: string
          domain_name: string
          attributes?: unknown[]
        }>
        results = data.slice(0, 10).map((item) => ({
          id: item.category_id,
          name: item.category_name,
          path: item.domain_name,
        }))
      } else {
        // Fallback: use the category suggest endpoint
        const fallbackRes = await fetch(
          `https://api.mercadolibre.com/sites/${siteId}/categories?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        )
        if (fallbackRes.ok) {
          const data = await fallbackRes.json() as Array<{ id: string; name: string }>
          results = data.slice(0, 10).map((item) => ({
            id: item.id,
            name: item.name,
            path: item.name,
          }))
        }
      }
    } else {
      // No query — return root categories for the site
      const rootRes = await fetch(
        `https://api.mercadolibre.com/sites/${siteId}/categories`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      )
      if (rootRes.ok) {
        const data = await rootRes.json() as Array<{ id: string; name: string }>
        results = data.slice(0, 20).map((item) => ({
          id: item.id,
          name: item.name,
          path: item.name,
        }))
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
