// ML category search — uses public ML endpoint, no auth required — v4
import { NextResponse, type NextRequest } from "next/server"
import { searchMLCategories } from "@/lib/channels/mercadolibre"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  const siteId = (url.searchParams.get("siteId") ?? "MLA").toUpperCase()

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const data = await searchMLCategories(q, siteId)
    const results = (data ?? []).map((item: Record<string, string>) => ({
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
