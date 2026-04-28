"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { signInAction } from "@/app/auth/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoginFormProps {
  next?: string
}

/**
 * Submit button uses the form's pending state from React 19's useFormStatus
 * so the spinner stays in sync with the actual server action lifecycle —
 * no manual `loading` flag needed.
 */
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full shadow-signal" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Ingresando...
        </>
      ) : (
        "Iniciar sesión"
      )}
    </Button>
  )
}

export function LoginForm({ next }: LoginFormProps) {
  const [state, action] = useActionState(signInAction, null)

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Carry the post-login redirect target along with the form. */}
      <input type="hidden" name="next" value={next ?? ""} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="font-sans text-xs uppercase tracking-[0.12em]">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@empresa.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="font-sans text-xs uppercase tracking-[0.12em]">
            Contraseña
          </Label>
          <Link
            href="/auth/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {"¿Olvidaste?"}
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  )
}
