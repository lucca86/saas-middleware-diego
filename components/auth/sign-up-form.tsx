"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function SignUpForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const emailRedirectTo =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { full_name: fullName },
      },
    })

    if (error) {
      toast.error("No pudimos crear tu cuenta", { description: error.message })
      setLoading(false)
      return
    }

    router.push("/auth/sign-up-success")
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name" className="font-sans text-xs uppercase tracking-[0.12em]">
          Nombre completo
        </Label>
        <Input
          id="full_name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
          placeholder="Alex Chen"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="font-sans text-xs uppercase tracking-[0.12em]">
          Email corporativo
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          placeholder="tu@empresa.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="font-sans text-xs uppercase tracking-[0.12em]">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <p className="font-sans text-xs text-muted-foreground">Al menos 8 caracteres.</p>
      </div>

      <Button type="submit" className="w-full shadow-signal" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>
    </form>
  )
}
