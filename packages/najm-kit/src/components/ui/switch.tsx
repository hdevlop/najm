import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "../../lib/cn"

export type SwitchSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl'
export type SwitchColor = 'default' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'neutral'

const TRACK: Record<SwitchSize, string> = {
  xs:      'h-3 w-5',
  sm:      'h-4 w-7',
  default: 'h-[1.15rem] w-8',
  lg:      'h-5 w-10',
  xl:      'h-6 w-12',
}

const THUMB: Record<SwitchSize, string> = {
  xs:      'size-2 data-[state=checked]:translate-x-[calc(100%+3px)] data-[state=unchecked]:translate-x-[-1px]',
  sm:      'size-3 data-[state=checked]:translate-x-[calc(100%+3px)] data-[state=unchecked]:translate-x-[-1px]',
  default: 'size-4 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-[-2px]',
  lg:      'size-4 data-[state=checked]:translate-x-[calc(100%+7px)] data-[state=unchecked]:translate-x-[-1px]',
  xl:      'size-5 data-[state=checked]:translate-x-[calc(100%+6px)] data-[state=unchecked]:translate-x-[-2px]',
}

const COLOR: Record<SwitchColor, string> = {
  default:   'data-[state=checked]:bg-primary',
  primary:   'data-[state=checked]:bg-violet-500',
  secondary: 'data-[state=checked]:bg-purple-500',
  accent:    'data-[state=checked]:bg-orange-500',
  info:      'data-[state=checked]:bg-cyan-500',
  success:   'data-[state=checked]:bg-emerald-500',
  warning:   'data-[state=checked]:bg-amber-400',
  error:     'data-[state=checked]:bg-red-500',
  neutral:   'data-[state=checked]:bg-slate-500',
}

interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  size?: SwitchSize
  color?: SwitchColor
}

function Switch({ className, size = 'default', color = 'default', ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none",
        "data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRACK[size],
        COLOR[color],
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background pointer-events-none block rounded-full ring-0 transition-transform",
          THUMB[size]
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
