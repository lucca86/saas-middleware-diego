import type { AttributeDef } from "./types"

/**
 * Return the list of attribute definitions that drive variant generation.
 * Only `select`-type attributes with `is_variant = true` participate.
 */
export function variantAttributes(attrs: AttributeDef[]): AttributeDef[] {
  return attrs.filter((a) => a.is_variant && a.type === "select" && (a.options?.length ?? 0) > 0)
}

/**
 * Generate the cartesian product of all variant attributes.
 * For `[{size:[S,M]}, {color:[Red,Blue]}]` returns
 *   [{size:'S', color:'Red'}, {size:'S', color:'Blue'},
 *    {size:'M', color:'Red'}, {size:'M', color:'Blue'}]
 * Returns a single empty combination `[{}]` when there are no variant attrs,
 * representing the "single default variant" case.
 */
export function generateCombinations(
  attrs: AttributeDef[],
): Array<Record<string, string>> {
  const variantAttrs = variantAttributes(attrs)
  if (variantAttrs.length === 0) return [{}]

  return variantAttrs.reduce<Array<Record<string, string>>>(
    (acc, attr) => {
      const options = attr.options ?? []
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
