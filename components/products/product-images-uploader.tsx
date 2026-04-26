"use client"

import Image from "next/image"
import { useCallback, useRef, useState, useTransition } from "react"
import { Star, Trash2, Upload, GripVertical, ImageOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  deleteProductImage,
  setPrimaryImage,
  reorderProductImages,
} from "@/app/app/[tenant]/products/[id]/images/actions"
import type { ProductImage } from "@/lib/products/images"

interface Props {
  tenantSlug: string
  productId: string
  initial: ProductImage[]
  readonly?: boolean
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/avif,image/gif"
const MAX_BYTES = 10 * 1024 * 1024

function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export function ProductImagesUploader({ tenantSlug, productId, initial, readonly }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initial)
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: no es una imagen`)
          continue
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: supera 10 MB`)
          continue
        }

        const tempId = crypto.randomUUID()
        setUploading((u) => [...u, { id: tempId, name: file.name }])

        try {
          // Read natural dimensions client-side so we can persist them without
          // decoding the image on the server.
          const dims = await readDimensions(file)

          // Single multipart POST: server uploads to R2 and inserts the row.
          // Avoids browser-to-R2 CORS issues entirely.
          const form = new FormData()
          form.append("productId", productId)
          form.append("file", file, file.name)
          if (dims?.width) form.append("width", String(dims.width))
          if (dims?.height) form.append("height", String(dims.height))

          const res = await fetch("/api/uploads/direct", { method: "POST", body: form })
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j.error ?? "No se pudo subir la imagen")
          }
          const reg = (await res.json()) as {
            id: string
            storageKey: string
            url: string
            width: number | null
            height: number | null
            sizeBytes: number
            mimeType: string
            isPrimary: boolean
            position: number
          }

          // Optimistically add it to the gallery
          setImages((prev) => [
            ...prev,
            {
              id: reg.id,
              product_id: productId,
              variant_id: null,
              storage_key: reg.storageKey,
              url: reg.url,
              width: reg.width,
              height: reg.height,
              size_bytes: reg.sizeBytes,
              mime_type: reg.mimeType,
              alt: null,
              position: reg.position,
              is_primary: reg.isPrimary,
              created_at: new Date().toISOString(),
            },
          ])
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error subiendo imagen")
        } finally {
          setUploading((u) => u.filter((x) => x.id !== tempId))
        }
      }
    },
    [productId, tenantSlug],
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (readonly) return
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  async function onDelete(id: string) {
    const prev = images
    setImages((list) => list.filter((i) => i.id !== id))
    startTransition(async () => {
      const res = await deleteProductImage(tenantSlug, id)
      if (!res.ok) {
        toast.error(res.error)
        setImages(prev)
      }
    })
  }

  async function onSetPrimary(id: string) {
    const prev = images
    setImages((list) => list.map((i) => ({ ...i, is_primary: i.id === id })))
    startTransition(async () => {
      const res = await setPrimaryImage(tenantSlug, id)
      if (!res.ok) {
        toast.error(res.error)
        setImages(prev)
      }
    })
  }

  function onDragStartItem(id: string) {
    setDraggingId(id)
  }
  function onDragOverItem(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (!draggingId || draggingId === overId) return
    setImages((list) => {
      const fromIdx = list.findIndex((i) => i.id === draggingId)
      const toIdx = list.findIndex((i) => i.id === overId)
      if (fromIdx === -1 || toIdx === -1) return list
      const next = [...list]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }
  function onDragEndItem() {
    if (!draggingId) return
    setDraggingId(null)
    const orderedIds = images.map((i) => i.id)
    startTransition(async () => {
      const res = await reorderProductImages(tenantSlug, productId, orderedIds)
      if (!res.ok) toast.error(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dropzone */}
      {!readonly ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center transition",
            "hover:border-primary/60 hover:bg-muted/60",
            dragOver && "border-primary bg-primary/5",
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
        >
          <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-display text-sm font-bold text-foreground">
              Arrastrá imágenes acá o hacé click
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              JPG, PNG, WEBP o AVIF — hasta 10 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </div>
      ) : null}

      {/* Uploads in progress */}
      {uploading.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {uploading.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs"
            >
              <Spinner className="h-3.5 w-3.5" />
              <span className="font-mono text-muted-foreground">Subiendo</span>
              <span className="truncate">{u.name}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Gallery */}
      {images.length === 0 && uploading.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-card p-6 text-center">
          <ImageOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="font-mono text-xs text-muted-foreground">Sin imágenes todavía</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li
              key={img.id}
              draggable={!readonly}
              onDragStart={() => onDragStartItem(img.id)}
              onDragOver={(e) => onDragOverItem(e, img.id)}
              onDragEnd={onDragEndItem}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-md border border-border bg-muted",
                draggingId === img.id && "opacity-50",
              )}
            >
              <Image src={img.url} alt={img.alt ?? ""} fill sizes="200px" className="object-cover" unoptimized />

              {img.is_primary ? (
                <Badge className="absolute left-1.5 top-1.5 bg-primary text-primary-foreground shadow-signal">
                  Principal
                </Badge>
              ) : null}

              {!readonly ? (
                <>
                  <div className="absolute inset-x-0 top-0 flex items-start justify-end gap-1 bg-gradient-to-b from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                    {!img.is_primary ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={() => onSetPrimary(img.id)}
                        title="Marcar como principal"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => onDelete(img.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="absolute bottom-1.5 left-1.5 cursor-grab rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100">
                    <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
