import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground border-border bg-background w-full min-w-0 rounded-lg border px-4 py-4 text-sm file:inline-flex file:border-0 file:bg-transparent file:px-4 file:py-4 file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-error",
        className
      )}
      {...props}
    />
  )
}

export { Input }
