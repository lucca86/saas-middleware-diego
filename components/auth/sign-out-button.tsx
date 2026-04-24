"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function SignOutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const router = useRouter()

  async function onSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <Button variant={variant} size="sm" onClick={onSignOut}>
      <LogOut className="mr-2 h-4 w-4" />
      Salir
    </Button>
  )
}
