import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"
import { NIcon, type NIconSource } from "../Icon"

const alertVariants = cva(
  "relative flex w-full rounded-lg border text-sm transition-colors",
  {
    variants: {
      tone: {
        default: "",
        info: "",
        success: "",
        warning: "",
        destructive: "",
        error: "",
      },
      look: {
        soft: "",
        outline: "bg-transparent",
        dash: "bg-transparent border-dashed",
        solid: "border-transparent",
      },
      size: {
        sm: "gap-2 px-3 py-2 text-xs",
        md: "gap-2.5 px-3 py-2.5 text-sm",
        lg: "gap-3 px-4 py-3 text-base",
      },
      orientation: {
        horizontal: "items-start",
        vertical: "flex-col items-start",
        responsive: "flex-col items-start sm:flex-row sm:items-center",
      },
    },
    compoundVariants: [
      { tone: "default", look: "soft", class: "border-border bg-card text-foreground" },
      { tone: "default", look: ["outline", "dash"], class: "border-border text-foreground" },
      { tone: "default", look: "solid", class: "bg-foreground text-background" },

      { tone: "info", look: "soft", class: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
      { tone: "info", look: ["outline", "dash"], class: "border-sky-500/50 text-sky-700 dark:text-sky-300" },
      { tone: "info", look: "solid", class: "bg-sky-500 text-white" },

      { tone: "success", look: "soft", class: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
      { tone: "success", look: ["outline", "dash"], class: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300" },
      { tone: "success", look: "solid", class: "bg-emerald-500 text-white" },

      { tone: "warning", look: "soft", class: "border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-300" },
      { tone: "warning", look: ["outline", "dash"], class: "border-amber-400/60 text-amber-700 dark:text-amber-300" },
      { tone: "warning", look: "solid", class: "bg-amber-400 text-slate-950" },

      { tone: ["destructive", "error"], look: "soft", class: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" },
      { tone: ["destructive", "error"], look: ["outline", "dash"], class: "border-red-500/50 text-red-700 dark:text-red-300" },
      { tone: ["destructive", "error"], look: "solid", class: "bg-red-500 text-white" },
    ],
    defaultVariants: {
      tone: "default",
      look: "soft",
      size: "md",
      orientation: "horizontal",
    },
  }
)

const alertContentVariants = cva("min-w-0 flex-1", {
  variants: {
    size: {
      sm: "space-y-0.5",
      md: "space-y-0.5",
      lg: "space-y-1",
    },
  },
  defaultVariants: { size: "md" },
})

const defaultToneIcons: Record<string, string> = {
  default: "info",
  info: "info",
  success: "check-circle-2",
  warning: "alert-triangle",
  destructive: "alert-circle",
  error: "alert-circle",
}

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>
export type AlertLook = NonNullable<VariantProps<typeof alertVariants>["look"]>
export type AlertSize = NonNullable<VariantProps<typeof alertVariants>["size"]>
export type AlertOrientation = NonNullable<VariantProps<typeof alertVariants>["orientation"]>
export type AlertVariant = AlertTone

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  variant?: AlertVariant
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  icon?: NIconSource | React.ReactNode | false
}

export function Alert({
  className,
  variant,
  tone: toneProp,
  look,
  size = "md",
  orientation,
  title,
  description,
  actions,
  icon,
  children,
  ...props
}: AlertProps) {
  const tone = (toneProp ?? variant ?? "default") as AlertTone
  const resolvedSize = (size ?? "md") as AlertSize
  const hasShortcut =
    title !== undefined || description !== undefined || actions !== undefined || icon !== undefined
  const rawIcon = icon === false ? null : icon === undefined ? (hasShortcut ? defaultToneIcons[tone] : null) : icon
  const iconSize = resolvedSize === "lg" ? 20 : 16

  return (
    <div
      role="alert"
      className={cn(alertVariants({ tone, look, size: resolvedSize, orientation }), className)}
      {...props}
    >
      {hasShortcut ? (
        <>
          {rawIcon && (
            <NIcon
              aria-hidden="true"
              icon={rawIcon as NIconSource}
              size={iconSize}
              className="mt-0.5 shrink-0"
            />
          )}
          <div className={alertContentVariants({ size: resolvedSize })}>
            {title && <p className="font-semibold leading-none">{title}</p>}
            {description && <p className="leading-5 opacity-85">{description}</p>}
            {!title && !description && children}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </>
      ) : (
        children
      )}
    </div>
  )
}

const NAlert = Alert

export { NAlert, alertVariants }
