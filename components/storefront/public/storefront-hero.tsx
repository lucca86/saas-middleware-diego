import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { PublicTenant } from "@/lib/storefront/types"

/**
 * Editorial-style hero. The product photography of the catalog itself
 * carries the visual weight via the featured shelf below, so we keep the
 * hero typographic and airy. Big serif title, restrained subtitle, single
 * thin separator. Works for any vertical (fashion, deli, vinería).
 */
export function StorefrontHero({ tenant }: { tenant: PublicTenant }) {
  const config = tenant.storefront_config
  const title = config.hero_title || tenant.name
  const subtitle = config.hero_subtitle

  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 md:px-8 md:pb-24 md:pt-28 lg:pb-28 lg:pt-32">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Catálogo · {new Date().getFullYear()}
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.025em] text-foreground text-balance">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-6 lg:items-end lg:text-right">
            <Link
              href="#catalogo"
              className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground transition hover:text-foreground/70"
            >
              Ver catálogo completo
              <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
            </Link>
            {config.about ? (
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:text-right">
                {config.about.length > 200
                  ? `${config.about.slice(0, 200).trim()}…`
                  : config.about}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
