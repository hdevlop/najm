import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-secondary/60 bg-secondary/40 text-secondary-foreground [a&]:hover:bg-secondary/60",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/20 dark:text-red-300 dark:bg-destructive/15",
        success: "border-green-500/30 bg-green-500/10 text-green-700 [a&]:hover:bg-green-500/15 dark:text-green-300 dark:bg-green-500/10",
        warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 [a&]:hover:bg-yellow-500/15 dark:text-yellow-300 dark:bg-yellow-500/10",
        outline: "border-border/50 text-foreground [a&]:hover:bg-accent/50 [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({ className, variant, asChild = false, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
