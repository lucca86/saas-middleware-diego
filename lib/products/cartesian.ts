import type { AttributeDef, AttributeSelection, SizeCurve } from "./types"

/**
 * Return the list of attribute definitions that drive variant generation.
 * Only `select`-type attributes with `is_variant = true` participate.
 * An attribute with a `source_curve_id` qualifies even if it has no options
 * defined locally — values come from the curve.
 */
export function variantAttributes(attrs: AttributeDef[]): AttributeDef[] {
  return attrs.filter(
    (a) =>
      a.is_variant &&
      a.type === "select" &&
      ((a.options?.length ?? 0) > 0 || (a.source_curve_id ?? null) !== null),
  )
}

/**
 * Resolve the effective list of options for an attribute, taking into account
 * its source curve (if any) and an optional product-level override.
 */
export function effectiveOptions(
  attr: AttributeDef,
  curves: SizeCurve[],
  overrideCurveId?: string | null,
): string[] {
  const curveId = overrideCurveId ?? attr.source_curve_id ?? null
  if (curveId) {
    const c = curves.find((x) => x.id === curveId)
    if (c) return c.values
  }
  return attr.options ?? []
}

/**
 * Generate the cartesian product of all variant attributes, restricted to the
 * values selected for this product.
 *
 * `selections` is keyed by attribute key; each entry contains the subset of
 * values to use. When an attribute is missing from `selections` (or its values
 * array is empty), we fall back to `attr.options` for backward compatibility.
 *
 * Returns a single empty combination `[{}]` when there are no variant attrs,
 * representing the "single default variant" case.
 */
export function generateCombinations(
  variantAttrs: AttributeDef[],
  selections: Record<string, AttributeSelection> = {},
): Array<Record<string, string>> {
  if (variantAttrs.length === 0) return [{}]

  return variantAttrs.reduce<Array<Record<string, string>>>(
    (acc, attr) => {
      const sel = selections[attr.key]
      const options = sel?.values && sel.values.length > 0 ? sel.values : attr.options ?? []
      if (options.length === 0) return acc
      const next: Array<Record<string, string>> = []
      for (const row of acc) {
        for (const opt of options) {
          next.push({ ...row, [attr.key]: opt })
        }
      }
      return next
    },
    [{}],
  )
}

/**
 * Stable string key for a variant based on its attribute values, so we can
 * match an existing DB variant with a generated combination.
 */
export function variantKey(attrs: Record<string, string>): string {
  const sortedKeys = Object.keys(attrs).sort()
  return sortedKeys.map((k) => `${k}=${attrs[k]}`).join("|")
}
