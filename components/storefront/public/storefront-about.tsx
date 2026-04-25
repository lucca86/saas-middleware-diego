import type { StorefrontConfig } from "@/lib/storefront/types"

export function StorefrontAbout({ config }: { config: StorefrontConfig }) {
  if (!config.about) return null
  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 pt-4 md:px-6">
      <div className="rounded-lg border border-border bg-card/30 p-6 md:p-8">
        <h2 className="font-display text-xl font-bold text-foreground">Sobre nosotros</h2>
        <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
          {config.about}
        </p>
      </div>
    </section>
  )
}
