import type { PublicTenant } from "@/lib/storefront/types"

export function StorefrontHero({ tenant }: { tenant: PublicTenant }) {
  const config = tenant.storefront_config
  const title = config.hero_title || tenant.name
  const subtitle = config.hero_subtitle

  return (
    <section className="border-b border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground text-balance md:text-6xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  )
}
