import * as React from "react"
import { cn } from "@/lib/utils"
import { GlassCard } from "./GlassCard"

interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: React.ReactNode
  icon?: React.ReactNode
  delta?: string
  deltaType?: "positive" | "negative" | "neutral"
}

export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ className, title, value, icon, delta, deltaType = "neutral", ...props }, ref) => {
    return (
      <GlassCard
        ref={ref}
        className={cn("p-4 flex flex-col justify-between space-y-2 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg", className)}
        {...props}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-muted">{title}</p>
          {icon && <div className="text-brand-light opacity-80">{icon}</div>}
        </div>
        <div>
          <div className="text-2xl font-bold text-ink">{value}</div>
          {delta && (
            <p
              className={cn(
                "text-xs font-medium mt-1",
                deltaType === "positive" ? "text-accent-success" : deltaType === "negative" ? "text-accent-danger" : "text-ink-muted"
              )}
            >
              {delta}
            </p>
          )}
        </div>
      </GlassCard>
    )
  }
)
StatTile.displayName = "StatTile"