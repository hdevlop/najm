import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/cn"

export interface NativeSelectOption {
  value: string
  label: string
}

export interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: NativeSelectOption[]
  placeholder?: string
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, options, placeholder, value, ...props }, ref) => {
    const hasValue = value !== undefined && value !== ""
    return (
      <div className="relative">
        <select
          ref={ref}
          value={value}
          className={cn(
            "flex h-10 w-full appearance-none rounded-md border border-input bg-card px-3 py-1.5 pr-8 text-sm text-foreground shadow-sm transition-colors",
            "hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !hasValue && "text-muted-foreground",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    )
  }
)
NativeSelect.displayName = "NativeSelect"