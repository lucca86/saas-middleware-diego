// v3
import { NextResponse, type NextRequest } from "next/server"
import { searchMLCategories } from "@/lib/channels/mercadolibre"

export const runtime = "nodejs"

/**
 * GET /api/channels/mercadolibre/categories?q=...&siteId=MLA
 *
 * Searches ML categories using the public domain_discovery endpoint.
 * No auth required — the endpoint is public.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = url.searchParams.get("q") ?? ""
  const siteId = url.searchParams.get("siteId") ?? "MLA"

  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const data = await searchMLCategories(q, siteId)
    const results = data.map((item) => ({
      id: item.category_id,
      name: item.category_name,
      path: item.domain_id ?? item.category_name,
    }))
    return NextResponse.json({ results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
