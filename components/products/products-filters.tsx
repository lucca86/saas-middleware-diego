"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  types: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string }>
  defaultValues: {
    q: string
    status: "all" | "draft" | "active" | "archived"
    typeId: string
    categoryId: string
  }
}

export function ProductsFilters({ types, categories, defaultValues }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [q, setQ] = useState(defaultValues.q)
  const [status, setStatus] = useState(defaultValues.status)
  const [typeId, setTypeId] = useState(defaultValues.typeId)
  const [categoryId, setCategoryId] = useState(defaultValues.categoryId)

  // Debounced search update
  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (q) next.set("q", q)
      else next.delete("q")
      startTransition(() => {
        router.replace(`?${next.toString()}`, { scroll: false })
      })
    }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value && value !== "all") next.set(key, value)
    else next.delete(key)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="flex-1 min-w-[240px]">
        <InputGroupAddon>
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Buscar por nombre"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar productos"
        />
      </InputGroup>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as never)
          update("status", v)
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="draft">Borradores</SelectItem>
          <SelectItem value="archived">Archivados</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={typeId}
        onValueChange={(v) => {
          setTypeId(v)
          update("type", v)
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {types.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={categoryId}
        onValueChange={(v) => {
          setCategoryId(v)
          update("category", v)
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
