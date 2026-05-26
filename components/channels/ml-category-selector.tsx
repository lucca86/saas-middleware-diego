"use client"

import { useState, useCallback, useRef, useTransition } from "react"
import { Search, CheckCircle2, Loader2, Tag, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveMLChannelConfig } from "@/app/app/[tenant]/channels/actions"

interface MLCategory {
  id: string
  name: string
  path: string
}

interface MLCategorySelectorProps {
  tenantSlug: string
  channelId: string
  siteId?: string
  currentCategoryId: string | null
  currentCategoryName: string | null
  canManage: boolean
  onSaved?: (categoryId: string, categoryName: string) => void
}

export function MLCategorySelector({
  tenantSlug,
  channelId,
  siteId = "MLA",
  currentCategoryId,
  currentCategoryName,
  canManage,
  onSaved,
}: MLCategorySelectorProps) {
  const [open, setOpen] = useState(!currentCategoryId)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MLCategory[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<MLCategory | null>(
    currentCategoryId && currentCategoryName
      ? { id: currentCategoryId, name: currentCategoryName, path: currentCategoryName }
      : null,
  )
  const [saving, startSave] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/channels/mercadolibre/categories?channelId=${channelId}&q=${encodeURIComponent(q)}&siteId=${siteId}`,
        )
        const data = await res.json() as { results?: MLCategory[]; error?: string }
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    },
    [channelId, siteId],
  )

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  function handleSelect(cat: MLCategory) {
    setSelected(cat)
    setResults([])
    setQuery("")
    setSavedOk(false)
    setSaveError(null)
  }

  function handleSave() {
    if (!selected) return
    setSaveError(null)
    setSavedOk(false)
    startSave(async () => {
      const res = await saveMLChannelConfig(tenantSlug, channelId, {
        default_ml_category_id: selected.id,
        default_ml_category_name: selected.name,
      })
      if (res.ok) {
        setSavedOk(true)
        setOpen(false)
        onSaved?.(selected.id, selected.name)
      } else {
        setSaveError(res.error)
      }
    })
  }

  const displayName = selected?.name ?? currentCategoryName

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs"
      >
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          Categoría ML por defecto
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {displayName && !open && (
        <p className="text-xs text-muted-foreground truncate pl-5">
          <span className="font-mono text-[10px] text-foreground">{selected?.id ?? currentCategoryId}</span>
          {" · "}
          {displayName}
        </p>
      )}

      {open && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Buscá la categoría de ML que mejor describe tu catálogo. Se usa cuando un producto no tiene categoría propia.
          </p>

          {selected && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate font-medium text-foreground">{selected.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{selected.id}</span>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={handleQueryChange}
              onFocus={() => { if (!query && results.length === 0) search("") }}
              placeholder="Ej: Remeras, Calzado deportivo…"
              className="h-8 pl-8 text-xs"
              disabled={!canManage}
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-md border border-border bg-background divide-y divide-border/40">
              {results.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-xs font-medium text-foreground truncate">{cat.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{cat.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}

          {savedOk && (
            <p className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Guardado correctamente.
            </p>
          )}

          <Button
            size="sm"
            className="w-full"
            disabled={!selected || saving || !canManage}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar categoría por defecto
          </Button>
        </div>
      )}
    </div>
  )
}
