import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  uploadProductImageDirect,
  r2IsConfigured,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/r2/client"

// Allow large multipart bodies up to MAX_UPLOAD_BYTES (10 MB).
export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request) {
  if (!r2IsConfigured()) {
    return NextResponse.json(
      { error: "Cloudflare R2 no está configurado. Agregá las variables de entorno." },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const productId = form.get("productId")
  const file = form.get("file")

  if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId)) {
    return NextResponse.json({ error: "productId inválido" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Formato no soportado" }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 10 MB" }, { status: 413 })
  }

  // Verify product + role
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, tenant_id")
    .eq("id", productId)
    .maybeSingle()
  if (prodErr || !product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  const { data: roleRow } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", product.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!roleRow || !["owner", "admin", "operator"].includes(roleRow.role)) {
    return NextResponse.json({ error: "Sin permiso para subir imágenes" }, { status: 403 })
  }

  // Optional dimension hints from the client (client-side reads natural
  // width/height before uploading; the server doesn't need to decode the image).
  const widthRaw = form.get("width")
  const heightRaw = form.get("height")
  const width = typeof widthRaw === "string" ? Number.parseInt(widthRaw, 10) : null
  const height = typeof heightRaw === "string" ? Number.parseInt(heightRaw, 10) : null

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let upload: { storageKey: string; publicUrl: string }
  try {
    upload = await uploadProductImageDirect({
      tenantId: product.tenant_id,
      productId: product.id,
      contentType: file.type,
      body: buffer,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falló la subida a R2"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Determine next position and primary flag
  const { data: existing } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", product.id)
    .order("position", { ascending: false })
    .limit(1)
  const position = existing && existing[0] ? existing[0].position + 1 : 0
  const isPrimary = position === 0

  const { data: row, error: insErr } = await supabase
    .from("product_images")
    .insert({
      tenant_id: product.tenant_id,
      product_id: product.id,
      storage_key: upload.storageKey,
      url: upload.publicUrl,
      width: Number.isFinite(width) && width ? width : null,
      height: Number.isFinite(height) && height ? height : null,
      size_bytes: file.size,
      mime_type: file.type,
      position,
      is_primary: isPrimary,
      uploaded_by: user.id,
    })
    .select("id")
    .single()

  if (insErr || !row) {
    return NextResponse.json(
      { error: insErr?.message ?? "No se pudo registrar la imagen" },
      { status: 500 },
    )
  }

  return NextResponse.json({
    id: row.id,
    storageKey: upload.storageKey,
    url: upload.publicUrl,
    width: Number.isFinite(width) && width ? width : null,
    height: Number.isFinite(height) && height ? height : null,
    sizeBytes: file.size,
    mimeType: file.type,
    isPrimary,
    position,
  })
}
