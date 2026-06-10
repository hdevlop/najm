import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/cn"
import { NIcon, type NIconSource } from "../Icon"

export type SwapEffect = "none" | "rotate" | "flip"
export type SwapSize = "sm" | "md" | "lg" | "icon"
export type SwapState = boolean | "indeterminate"

export interface SwapProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  defaultChecked?: boolean
  state?: SwapState
  onCheckedChange?: (checked: boolean) => void
  onStateChange?: (state: SwapState) => void
  /** Full custom content for the on state — overrides onIcon/onText */
  on?: React.ReactNode
  /** Full custom content for the off state — overrides offIcon/offText */
  off?: React.ReactNode
  /** Full custom content for the indeterminate state */
  indeterminate?: React.ReactNode
  /** Icon shown when state is on */
  onIcon?: NIconSource
  /** Icon shown when state is off */
  offIcon?: NIconSource
  /** Icon shown when state is indeterminate */
  indeterminateIcon?: NIconSource
  /** Text shown when state is on */
  onText?: string
  /** Text shown when state is off */
  offText?: string
  /** Text shown when state is indeterminate */
  indeterminateText?: string
  effect?: SwapEffect
  size?: SwapSize
  disabled?: boolean
}

export const swapVariants = cva(
  "inline-flex items-center justify-center gap-1.5 relative cursor-pointer select-none transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      effect: {
        none: "",
        rotate: "[&[data-state=on]]:rotate-180",
        flip: "[&[data-state=on]]:[transform:rotateY(180deg)]",
      },
      size: {
        sm: "h-7 min-w-7 px-2 text-xs rounded-md",
        md: "h-9 min-w-9 px-3 text-sm rounded-md",
        lg: "h-11 min-w-11 px-4 text-base rounded-lg",
        icon: "h-9 w-9 rounded-md",
      },
    },
    defaultVariants: {
      effect: "none",
      size: "md",
    },
  }
)

function getDerivedState(checked: boolean | undefined, state: SwapState | undefined): SwapState {
  if (state !== undefined) return state
  if (checked !== undefined) return checked
  return false
}

function buildSlotContent(
  icon: NIconSource | undefined,
  text: string | undefined,
  fallback: React.ReactNode
): React.ReactNode {
  if (icon && text) {
    return (
      <>
        <NIcon aria-hidden="true" icon={icon} />
        <span>{text}</span>
      </>
    )
  }
  if (icon) return <NIcon aria-hidden="true" icon={icon} />
  if (text) return <span>{text}</span>
  return fallback
}

export function Swap({
  checked: controlledChecked,
  defaultChecked = false,
  state: controlledState,
  onCheckedChange,
  onStateChange,
  onClick,
  on,
  off,
  indeterminate: indeterminateContent,
  onIcon,
  offIcon,
  indeterminateIcon,
  onText,
  offText,
  indeterminateText,
  effect = "none",
  size = "md",
  disabled = false,
  className,
  ...props
}: SwapProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked)
  const isControlled = controlledChecked !== undefined || controlledState !== undefined
  const currentState = getDerivedState(
    isControlled ? (controlledChecked ?? false) : internalChecked,
    controlledState
  )

  const dataState = currentState === "indeterminate" ? "indeterminate" : currentState ? "on" : "off"
  const ariaPressed = currentState === "indeterminate" ? "mixed" : currentState

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (disabled) return
    const next = currentState === "indeterminate" ? true : !currentState
    if (!isControlled) setInternalChecked(next)
    onCheckedChange?.(next)
    onStateChange?.(next)
  }, [currentState, disabled, isControlled, onCheckedChange, onClick, onStateChange])

  const offContent = on !== undefined ? off : buildSlotContent(offIcon, offText, "OFF")
  const onContent = on ?? buildSlotContent(onIcon, onText, "ON")
  const indetermContent = indeterminateContent ?? buildSlotContent(indeterminateIcon, indeterminateText, undefined)

  return (
    <button
      type="button"
      role="switch"
      aria-pressed={ariaPressed}
      data-state={dataState}
      disabled={disabled}
      onClick={handleClick}
      className={cn(swapVariants({ effect, size }), className)}
      {...props}
    >
      <span
        data-slot="swap-off"
        className={cn(
          "inline-flex items-center gap-1.5 transition-opacity duration-200",
          dataState === "off" ? "opacity-100" : "absolute opacity-0"
        )}
      >
        {offContent}
      </span>
      <span
        data-slot="swap-on"
        className={cn(
          "inline-flex items-center gap-1.5 transition-opacity duration-200",
          dataState === "on" ? "opacity-100" : "absolute opacity-0"
        )}
      >
        {onContent}
      </span>
      {indetermContent && (
        <span
          data-slot="swap-indeterminate"
          className={cn(
            "inline-flex items-center gap-1.5 transition-opacity duration-200",
            dataState === "indeterminate" ? "opacity-100" : "absolute opacity-0"
          )}
        >
          {indetermContent}
        </span>
      )}
    </button>
  )
}

export { Swap as NSwap }
export type NSwapProps = SwapProps

// Legacy slot components
export function SwapOn({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SwapOff({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SwapIndeterminate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
