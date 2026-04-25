import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { signProductImageUpload, r2IsConfigured, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/r2/client"

const Body = z.object({
  productId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  contentType: z.string().refine((t) => ALLOWED_IMAGE_TYPES.has(t), {
    message: "Formato de imagen no soportado",
  }),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, "El archivo supera el límite de 10 MB"),
})

export async function POST(req: Request) {
  if (!r2IsConfigured()) {
    return NextResponse.json(
      { error: "Cloudflare R2 no está configurado. Agregá las variables de entorno." },
      { status: 503 },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Solicitud inválida" },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // Verify the product belongs to a tenant the user can write to.
  // RLS guarantees we only see products from tenants we are members of,
  // and tenant_role() check below blocks viewers.
  const { data: product, error } = await supabase
    .from("products")
    .select("id, tenant_id")
    .eq("id", parsed.data.productId)
    .maybeSingle()

  if (error || !product) {
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

  try {
    const signed = await signProductImageUpload({
      tenantId: product.tenant_id,
      productId: product.id,
      contentType: parsed.data.contentType,
      contentLength: parsed.data.contentLength,
    })
    return NextResponse.json(signed)
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo firmar la subida"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
