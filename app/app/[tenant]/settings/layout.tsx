import type { ReactNode } from "react"
import { SettingsTabs } from "@/components/settings/settings-tabs"

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-on-surface md:text-5xl">
          Configuración <span className="text-primary">del espacio</span>
        </h1>
        <p className="max-w-2xl text-sm text-on-surface-variant leading-relaxed">
          Administrá los datos generales, miembros del equipo y preferencias de tu espacio de
          trabajo.
        </p>
      </div>

      <SettingsTabs tenantSlug={tenant} />

      <div>{children}</div>
    </div>
  )
}
