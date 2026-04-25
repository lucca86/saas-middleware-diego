import { notFound } from "next/navigation"
import Link from "next/link"
import { Instagram, Mail, MessageCircle } from "lucide-react"
import { getPublicTenant } from "@/lib/storefront/queries"
import { isHexColor } from "@/lib/storefront/utils"

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
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link
            href={`/s/${tenant.slug}`}
            className="font-display text-lg font-extrabold tracking-tight text-foreground"
          >
            {config.hero_title || tenant.name}
          </Link>

          <nav className="flex items-center gap-1 text-muted-foreground" aria-label="Contacto">
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
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>
            © {new Date().getFullYear()} {tenant.name}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]">
            powered by SignalCore
          </p>
        </div>
      </footer>
    </div>
  )
}
