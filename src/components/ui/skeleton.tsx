import { cn } from "@/lib/utils"

/**
 * A single inert bar standing in for content that has not arrived.
 *
 * The look lives in the `.skeleton` class in globals.css (a brass sweep over
 * `--surface-inset`) rather than here, so it themes with everything else and
 * so `prefers-reduced-motion` can switch the sweep off in one place.
 *
 * Utilities passed through `className` still win — `.skeleton` sits in the
 * `components` layer, so `h-4 w-2/5 rounded-full` override it as expected.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
