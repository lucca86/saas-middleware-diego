/**
 * Lightweight CSV parser + product import logic.
 *
 * Why no dependency: papaparse is overkill for our shape. We need quoted
 * fields, escaped quotes ("") and a configurable delimiter. ~40 LOC does it.
 *
 * Expected columns (case-insensitive, order-independent):
 *   name           required  Nombre del producto
 *   sku                      SKU del producto base (opcional)
 *   description              Descripción
 *   status                   draft | active | archived
 *   category                 Slug o nombre de la categoría (se busca por ambos)
 *   tags                     Lista separada por "|" o ","
 *   variant_sku              SKU de la variante
 *   variant_barcode          Código de barras
 *   variant_price            Precio (default 0)
 *   variant_cost             Costo (opcional)
 *   variant_compare_at       Precio antes (opcional)
 *   variant_stock            Stock inicial (entero)
 *   attr_*                   Cualquier columna que empiece con `attr_` se
 *                            considera atributo de la variante. Por ej:
 *                            attr_talle=M, attr_color=Rojo
 *
 * Múltiples filas con el mismo `name` se agrupan como variantes del mismo producto.
 */

export type CsvRow = Record<string, string>

export type ParsedProduct = {
  name: string
  sku: string | null
  description: string | null
  status: "draft" | "active" | "archived"
  category: string | null
  tags: string[]
  variants: Array<{
    sku: string | null
    barcode: string | null
    price: number
    cost: number | null
    compare_at_price: number | null
    stock: number
    attributes: Record<string, string>
  }>
}

export type ParseResult = {
  products: ParsedProduct[]
  errors: Array<{ line: number; message: string }>
  totalRows: number
}

export function parseCsv(text: string, delimiter = ","): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      cell = ""
      if (row.length > 1 || row[0]) rows.push(row)
      row = []
    } else {
      cell += c
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.length > 1 || row[0]) rows.push(row)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((r) => {
    const obj: CsvRow = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim()
    })
    return obj
  })
}

function parseNum(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/\./g, "").replace(",", ".")
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseStatus(s: string | undefined): "draft" | "active" | "archived" {
  const v = (s ?? "").toLowerCase()
  if (v === "active" || v === "activo") return "active"
  if (v === "archived" || v === "archivado") return "archived"
  return "draft"
}

export function buildProducts(rows: CsvRow[]): ParseResult {
  const errors: ParseResult["errors"] = []
  const grouped = new Map<string, ParsedProduct>()

  rows.forEach((r, idx) => {
    const line = idx + 2 // header is line 1
    const name = (r.name ?? "").trim()
    if (!name) {
      errors.push({ line, message: "Falta el campo 'name'." })
      return
    }

    const attributes: Record<string, string> = {}
    for (const key of Object.keys(r)) {
      if (key.startsWith("attr_") && r[key]) {
        const attrName = key.slice(5)
        attributes[attrName] = r[key]
      }
    }

    const price = parseNum(r.variant_price) ?? 0
    if (price < 0) {
      errors.push({ line, message: "El precio no puede ser negativo." })
      return
    }
    const stock = Math.max(0, Math.floor(parseNum(r.variant_stock) ?? 0))

    let prod = grouped.get(name)
    if (!prod) {
      prod = {
        name,
        sku: r.sku || null,
        description: r.description || null,
        status: parseStatus(r.status),
        category: r.category || null,
        tags: (r.tags ?? "")
          .split(/[|,]/)
          .map((t) => t.trim())
          .filter(Boolean),
        variants: [],
      }
      grouped.set(name, prod)
    }

    prod.variants.push({
      sku: r.variant_sku || null,
      barcode: r.variant_barcode || null,
      price,
      cost: parseNum(r.variant_cost),
      compare_at_price: parseNum(r.variant_compare_at),
      stock,
      attributes,
    })
  })

  // Products without explicit variant rows still need at least one default variant.
  for (const p of grouped.values()) {
    if (p.variants.length === 0) {
      p.variants.push({
        sku: p.sku,
        barcode: null,
        price: 0,
        cost: null,
        compare_at_price: null,
        stock: 0,
        attributes: {},
      })
    }
  }

  return {
    products: Array.from(grouped.values()),
    errors,
    totalRows: rows.length,
  }
}
