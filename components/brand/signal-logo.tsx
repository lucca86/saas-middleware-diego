import { cn } from "@/lib/utils"

interface SignalLogoProps {
  className?: string
  tagline?: string
  size?: "sm" | "md" | "lg"
}

/**
 * SignalCore wordmark. Matches the cyan/gradient treatment in the mockups.
 */
export function SignalLogo({ className, tagline = "Middleware Engine", size = "md" }: SignalLogoProps) {
  const sizes = {
    sm: { title: "text-base", tagline: "text-[10px]" },
    md: { title: "text-xl", tagline: "text-[11px]" },
    lg: { title: "text-3xl", tagline: "text-xs" },
  }

  return (
    <div className={cn("flex flex-col leading-tight", className)}>
      <span
        className={cn(
          "font-display font-extrabold tracking-tight text-primary",
          sizes[size].title,
        )}
      >
        SignalCore
      </span>
      {tagline ? (
        <span
          className={cn(
            "font-sans uppercase tracking-[0.18em] text-muted-foreground",
            sizes[size].tagline,
          )}
        >
          {tagline}
        </span>
      ) : null}
    </div>
  )
}
