import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
export type AvatarShape = "circle" | "rounded" | "square"
export type AvatarStatusType = "online" | "offline" | "busy" | "away"

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden",
  {
    variants: {
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
        xl: "size-16",
        "2xl": "size-20",
      },
      shape: {
        circle: "rounded-full",
        rounded: "rounded-lg",
        square: "rounded-none",
      },
      ring: {
        true: "ring-2 ring-background",
        false: "",
      },
    },
    defaultVariants: {
      size: "sm",
      shape: "circle",
      ring: false,
    },
  }
)

const fallbackVariants = cva(
  "flex size-full items-center justify-center bg-muted",
  {
    variants: {
      size: {
        xs: "text-[10px]",
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
        xl: "text-lg",
        "2xl": "text-xl",
      },
      shape: {
        circle: "rounded-full",
        rounded: "rounded-lg",
        square: "rounded-none",
      },
    },
    defaultVariants: {
      size: "sm",
      shape: "circle",
    },
  }
)

const statusColorMap: Record<AvatarStatusType, string> = {
  online: "bg-emerald-500",
  offline: "bg-slate-400",
  busy: "bg-red-500",
  away: "bg-amber-400",
}

const statusSizeMap: Record<AvatarSize, string> = {
  xs: "h-1.5 w-1.5 ring-1",
  sm: "h-2 w-2 ring-1",
  md: "h-2.5 w-2.5 ring-2",
  lg: "h-3 w-3 ring-2",
  xl: "h-3.5 w-3.5 ring-2",
  "2xl": "h-4 w-4 ring-2",
}

const ringColorMap: Record<AvatarRingColor, string> = {
  background: "ring-background",
  primary: "ring-primary ring-offset-2 ring-offset-background",
  secondary: "ring-secondary ring-offset-2 ring-offset-background",
  muted: "ring-muted ring-offset-2 ring-offset-background",
  destructive: "ring-destructive ring-offset-2 ring-offset-background",
}

export type AvatarRingColor = "background" | "primary" | "secondary" | "muted" | "destructive"

export interface AvatarProps
  extends Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, "size">,
    VariantProps<typeof avatarVariants> {
  src?: string
  alt?: string
  fallback?: React.ReactNode
  status?: AvatarStatusType
  ringColor?: AvatarRingColor
  imageClassName?: string
  fallbackClassName?: string
}

function Avatar({
  className,
  size = "sm",
  shape = "circle",
  ring = false,
  ringColor,
  src,
  alt,
  fallback,
  status,
  imageClassName,
  fallbackClassName,
  children,
  ...props
}: AvatarProps) {
  const hasShortcut = src !== undefined || fallback !== undefined
  const hasChildren = React.Children.count(children) > 0

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        avatarVariants({ size, shape, ring }),
        ring && ringColor ? ringColorMap[ringColor] : "",
        className,
      )}
      {...props}
    >
      {hasChildren ? (
        children
      ) : hasShortcut ? (
        <>
          {src && (
            <AvatarPrimitive.Image
              data-slot="avatar-image"
              src={src}
              alt={alt}
              className={cn("aspect-square size-full", imageClassName)}
            />
          )}
          <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(fallbackVariants({ size, shape }), fallbackClassName)}
          >
            {fallback}
          </AvatarPrimitive.Fallback>
        </>
      ) : (
        children
      )}
      {status && (
        <span
          data-slot="avatar-status"
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-background",
            statusColorMap[status],
            statusSizeMap[size ?? "sm"]
          )}
        />
      )}
    </AvatarPrimitive.Root>
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center rounded-full bg-muted", className)}
      {...props}
    />
  )
}

function AvatarStatus({
  status,
  size = "sm",
  className,
}: {
  status: AvatarStatusType
  size?: AvatarSize
  className?: string
}) {
  return (
    <span
      data-slot="avatar-status"
      className={cn(
        "absolute bottom-0 right-0 rounded-full ring-background",
        statusColorMap[status],
        statusSizeMap[size],
        className
      )}
    />
  )
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  ring?: boolean
}

function AvatarGroup({ ring = true, className, children, ...props }: AvatarGroupProps) {
  return (
    <div
      data-slot="avatar-group"
      className={cn("flex -space-x-2", className)}
      {...props}
    >
      {ring
        ? React.Children.map(children, (child) => {
            if (React.isValidElement<AvatarProps>(child) && child.type === Avatar) {
              return React.cloneElement(child, { ring: true, ...child.props })
            }
            return child
          })
        : children}
    </div>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarStatus,
  AvatarGroup,
  avatarVariants,
}
