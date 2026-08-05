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
        "size-4 shrink-0 rounded border border-input bg-background text-primary shadow-xs",
        "accent-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
