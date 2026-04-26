"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant/context"

/**
 * Public input. The user always passes a positive quantity; for `out` we
 * negate it on the server. `adjustment` carries an explicit `targetStock`
 * (the value the user wants the variant to land on) and we compute the
 * delta server-side from the current cached stock.
 */
const movementSchema = z
  .object({
    variantId: z.string().uuid(),
    type: z.enum(["in", "out", "adjustment"]),
    qty: z.coerce.number().int().min(1).optional(),
    targetStock: z.coerce.number().int().min(0).optional(),
    reason: z.string().min(1).max(120),
    notes: z.string().max(500).optional().nullable(),
    reference: z.string().max(120).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "adjustment") {
      if (val.targetStock === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indicá el stock objetivo",
          path: ["targetStock"],
        })
      }
    } else {
      if (val.qty === undefined || val.qty <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cantidad inválida",
          path: ["qty"],
        })
      }
    }
  })

export type StockMovementResult =
  | { ok: true; newStock: number }
  | { ok: false; error: string }

export async function recordStockMovement(
  tenantSlug: string,
  input: z.infer<typeof movementSchema>,
): Promise<StockMovementResult> {
  const parsed = movementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
  }

  const { tenant } = await requireTenant(tenantSlug)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado" }

  // Read variant to compute deltas and confirm it belongs to the tenant.
  const { data: variant, error: vErr } = await supabase
    .from("product_variants")
    .select("id, product_id, stock, tenant_id")
    .eq("id", parsed.data.variantId)
    .eq("tenant_id", tenant.id)
    .maybeSingle()

  if (vErr) return { ok: false, error: vErr.message }
  if (!variant) return { ok: false, error: "La variante no existe en este espacio" }

  // Compute the signed delta we will record.
  let qty: number
  if (parsed.data.type === "in") {
    qty = parsed.data.qty!
  } else if (parsed.data.type === "out") {
    qty = -parsed.data.qty!
    if ((variant.stock ?? 0) + qty < 0) {
      return {
        ok: false,
        error: `No hay stock suficiente. Stock actual: ${variant.stock}.`,
      }
    }
  } else {
    qty = parsed.data.targetStock! - (variant.stock ?? 0)
    if (qty === 0) {
      return { ok: false, error: "El stock objetivo coincide con el actual." }
    }
  }

  const { error: insErr } = await supabase.from("stock_movements").insert({
    tenant_id: tenant.id,
    product_id: variant.product_id,
    variant_id: variant.id,
    type: parsed.data.type,
    qty,
    reason: parsed.data.reason,
    notes: parsed.data.notes ?? null,
    reference: parsed.data.reference ?? null,
    created_by: user.id,
  })

  if (insErr) {
    // Surface the trigger's "stock insuficiente" check as a friendly message.
    if (insErr.message.includes("Stock insuficiente")) {
      return { ok: false, error: "El movimiento dejaría stock negativo." }
    }
    return { ok: false, error: insErr.message }
  }

  revalidatePath(`/app/${tenantSlug}/stock`)
  revalidatePath(`/app/${tenantSlug}/products`)
  revalidatePath(`/app/${tenantSlug}/products/${variant.product_id}`)

  return { ok: true, newStock: (variant.stock ?? 0) + qty }
}
