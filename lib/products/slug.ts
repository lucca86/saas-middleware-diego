/**
 * Normalize any string into a URL-safe slug.
 * - Removes diacritics
 * - Lowercases
 * - Replaces non-alphanumerics with '-'
 * - Collapses repeated dashes and trims edges
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
