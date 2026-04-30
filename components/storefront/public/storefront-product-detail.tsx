"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { MessageCircle, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  buildWhatsappUrl,
  findVariant,
  formatPrice,
  variantOptionsFromVariants,
} from "@/lib/storefront/utils"
import type {
  PublicProductDetail,
  StorefrontConfig,
} from "@/lib/storefront/types"
import { StorefrontAddToCart } from "./storefront-add-to-cart"

interface Props {
  tenantSlug: string
  currency: string
  config: StorefrontConfig
  detail: PublicProductDetail
}

export function StorefrontProductDetail({
  tenantSlug,
  currency,
  config,
  detail,
}: Props) {
  const { product, variants, images } = detail
  const variantAttrs = useMemo(() => variantOptionsFromVariants(variants), [variants])
  const variantKeys = Object.keys(variantAttrs)

  // Initial selection: first available value for each key, preferring in-stock.
  const initialSelection = useMemo(() => {
    const sel: Record<string, string> = {}
    if (variants.length === 0) return sel

    // Try to find a variant with stock.
    const inStock = variants.find((v) => (v.stock ?? 0) > 0) ?? variants[0]
    for (const k of variantKeys) {
      const value = inStock.attributes?.[k]
      if (typeof value === "string") sel[k] = value
    }
    return sel
  }, [variants, variantKeys])

  const [selection, setSelection] = useState<Record<string, string>>(initialSelection)
  const [activeImage, setActiveImage] = useState(0)

  const selected = useMemo(() => findVariant(variants, selection), [variants, selection])

  // For each option of an attribute, decide if it's currently in stock given
  // the rest of the selection. Lets us grey out impossible combos.
  function isOptionInStock(attrKey: string, value: string): boolean {
    const probe: Record<string, string> = { ...selection, [attrKey]: value }
    // Don't constrain by other attrs that might also become incompatible —
    // probe only against the changed attr if there's only one variant axis.
    if (variantKeys.length <= 1) {
      return variants.some((v) => v.attributes?.[attrKey] === value && (v.stock ?? 0) > 0)
    }
    const match = findVariant(variants, probe)
    return !!match && (match.stock ?? 0) > 0
  }

  function isOptionAvailable(attrKey: string, value: string): boolean {
    // Available means the combination exists, regardless of stock.
    const probe: Record<string, string> = { ...selection, [attrKey]: value }
    return !!findVariant(variants, probe)
  }

  const showPrice = !config.hide_prices
  const stock = selected?.stock ?? 0
  const inStock = stock > 0

  const [productUrl, setProductUrl] = useState(`/s/${tenantSlug}/p/${product.slug}`)
  useEffect(() => {
    setProductUrl(`${window.location.origin}/s/${tenantSlug}/p/${product.slug}`)
  }, [tenantSlug, product.slug])

  const variantLabel =
    Object.values(selection).filter(Boolean).join(" / ") || ""

  const waUrl = buildWhatsappUrl(config, {
    product: variantLabel ? `${product.name} (${variantLabel})` : product.name,
    url: productUrl,
  })

  return (
    <div className="mt-4 grid grid-cols-1 gap-8 md:mt-6 md:grid-cols-2 md:gap-10">
      {/* Gallery */}
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
          {images.length > 0 ? (
            <Image
              src={images[activeImage]?.url ?? images[0].url}
              alt={images[activeImage]?.alt ?? product.name}
              fill
              sizes="(max-width:768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Package className="h-12 w-12" />
            </div>
          )}
        </div>
        {images.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setActiveImage(i)}
                className={cn(
                  "relative h-16 w-16 overflow-hidden rounded-md border-2 bg-muted transition",
                  i === activeImage
                    ? "border-foreground"
                    : "border-transparent hover:border-foreground/30",
                )}
                aria-label={`Imagen ${i + 1}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? ""}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div>
        {product.category_name ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {product.category_name}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-foreground text-balance md:text-4xl">
          {product.name}
        </h1>

        {showPrice ? (
          <div className="mt-4 flex items-baseline gap-3">
            <p className="font-mono text-2xl font-bold text-foreground">
              {selected ? formatPrice(selected.price, currency) : "—"}
            </p>
            {selected?.compare_at_price && selected.compare_at_price > selected.price ? (
              <p className="font-mono text-sm text-muted-foreground line-through">
                {formatPrice(selected.compare_at_price, currency)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2">
          {selected ? (
            inStock ? (
              <Badge className="border-success/30 bg-success/15 text-success">
                Disponible {stock > 0 && stock < 6 ? `· ${stock} en stock` : ""}
              </Badge>
            ) : (
              <Badge variant="outline">Sin stock</Badge>
            )
          ) : (
            <Badge variant="outline">Combinación no disponible</Badge>
          )}
        </div>

        {/* Variant selectors */}
        {variantKeys.length > 0 ? (
          <div className="mt-6 space-y-5">
            {variantKeys.map((key) => (
              <div key={key}>
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {prettyKey(key)}
                  </p>
                  <p className="font-mono text-xs text-foreground">{selection[key]}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variantAttrs[key].map((value) => {
                    const available = isOptionAvailable(key, value)
                    const stocked = available && isOptionInStock(key, value)
                    const active = selection[key] === value
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() =>
                          setSelection((prev) => ({ ...prev, [key]: value }))
                        }
                        className={cn(
                          "min-w-[44px] rounded-md border px-3 py-2 text-sm transition",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-foreground hover:border-foreground/40",
                          !available &&
                            "cursor-not-allowed border-dashed text-muted-foreground/60 line-through hover:border-dashed",
                          available &&
                            !stocked &&
                            !active &&
                            "text-muted-foreground",
                        )}
                        aria-pressed={active}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* CTA: cart-first, WhatsApp as secondary follow-up */}
        <div className="mt-8 space-y-3">
          <StorefrontAddToCart
            tenantSlug={tenantSlug}
            variantId={selected?.id ?? null}
            disabled={!selected || !inStock}
            label={
              !selected
                ? "Combinación no disponible"
                : !inStock
                  ? "Sin stock"
                  : "Agregar al carrito"
            }
          />
          {waUrl ? (
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Consultar por WhatsApp
              </a>
            </Button>
          ) : null}
        </div>

        {product.description ? (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Descripción
            </h2>
            <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-foreground">
              {product.description}
            </p>
          </div>
        ) : null}

        {selected?.sku ? (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            SKU · {selected.sku}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function prettyKey(key: string): string {
  // turn "talle" / "color" / "tipo_de_tela" → "Talle" / "Color" / "Tipo de tela"
  const spaced = key.replace(/_/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
