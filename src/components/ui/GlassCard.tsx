import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const GlassCard = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        "backdrop-blur-xl bg-surface-glass border border-white/30 shadow-glass overflow-hidden",
        className
      )}
      {...props}
    />
  )
)
GlassCard.displayName = "GlassCard"