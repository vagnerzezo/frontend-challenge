import { cn } from "@/lib/utils"

/** Skeleton com shimmer; a animação é desligada em prefers-reduced-motion (index.css). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-surface-2", className)}
      {...props}
    />
  )
}

export { Skeleton }
