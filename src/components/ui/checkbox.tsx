import * as React from "react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  indeterminate,
  ref,
  ...props
}: React.ComponentProps<"input"> & {
  indeterminate?: boolean
}) {
  const innerRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = Boolean(indeterminate)
    }
  }, [indeterminate])

  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      ref={(node) => {
        innerRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }}
      className={cn(
        // appearance-none prevents iOS Safari from painting a solid dark fill
        // when color-scheme includes dark and the app UI is light.
        "size-4 shrink-0 appearance-none rounded-[4px] border shadow-xs",
        "border-[hsl(var(--input))] bg-[hsl(var(--background))] bg-center bg-no-repeat",
        "checked:border-[hsl(var(--primary))] checked:bg-[hsl(var(--primary))]",
        "indeterminate:border-[hsl(var(--primary))] indeterminate:bg-[hsl(var(--primary))]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring)/0.5)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
