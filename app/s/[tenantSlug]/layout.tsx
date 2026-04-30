import { notFound } from "next/navigation"
import Link from "next/link"
import { Instagram, Mail, MessageCircle } from "lucide-react"
import { getPublicTenant } from "@/lib/storefront/queries"
import { isHexColor } from "@/lib/storefront/utils"
import { cartCount, cartSubtotal, readCart } from "@/lib/cart/cookie"
import { StorefrontCartSheet } from "@/components/storefront/public/storefront-cart-sheet"

export const dynamic = "force-dynamic"

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getPublicTenant(tenantSlug)
  if (!tenant) notFound()

  const cart = await readCart(tenantSlug)

  const config = tenant.storefront_config
  const accent =
    config.accent && isHexColor(config.accent) ? config.accent : null
  const igHref = config.instagram
    ? `https://instagram.com/${config.instagram.replace(/^@/, "")}`
    : null
  const waHref = config.whatsapp
    ? `https://wa.me/${config.whatsapp.replace(/[^\d]/g, "")}`
    : null
  const mailHref = config.email ? `mailto:${config.email}` : null

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={accent ? ({ "--accent-brand": accent } as React.CSSProperties) : undefined}
      data-storefront
    >
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-8 md:py-5">
          <nav
            className="hidden items-center gap-1 text-muted-foreground md:flex"
            aria-label="Contacto"
          >
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
            {igHref ? (
              <a
                href={igHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            ) : null}
            {mailHref ? (
              <a
                href={mailHref}
                className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            ) : null}
          </nav>

          <Link
            href={`/s/${tenant.slug}`}
            className="col-start-1 justify-self-start text-balance font-display text-base font-bold tracking-[-0.01em] text-foreground md:col-start-2 md:justify-self-center md:text-xl"
          >
            {config.hero_title || tenant.name}
          </Link>

          <div className="col-start-3 flex items-center justify-self-end gap-1">
            <StorefrontCartSheet
              tenantSlug={tenant.slug}
              currency={tenant.currency}
              lines={cart.lines}
              count={cartCount(cart)}
              subtotal={cartSubtotal(cart)}
            />
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-border/40 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-foreground">
              {tenant.name}
            </p>
            <p className="text-xs">© {new Date().getFullYear()} · Todos los derechos reservados</p>
          </div>
          <div className="flex items-center gap-1">
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
            {igHref ? (
              <a
                href={igHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            ) : null}
            {mailHref ? (
              <a
                href={mailHref}
                className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]">
            powered by SignalCore
          </p>
        </div>
      </footer>
    </div>
  )
}
