import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "../../lib/cn"
import { focusRingClasses } from "../../theme/focus"

export type TabsVariant = "pills" | "underline" | "bordered" | "ghost"
export type TabsOrientation = "horizontal" | "vertical"

export interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  variant?: TabsVariant
  orientation?: TabsOrientation
}

function Tabs({
  className,
  variant = "pills",
  orientation = "horizontal",
  ...props
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-variant={variant}
      className={cn(
        orientation === "vertical" ? "flex flex-row gap-4" : "flex flex-col gap-2",
        className
      )}
      {...props}
    />
  )
}

const listVariantMap: Record<TabsVariant, string> = {
  pills: "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
  underline: "inline-flex w-full items-center justify-start gap-0 border-b border-border",
  bordered: "inline-flex w-full items-center justify-start gap-0",
  ghost: "inline-flex w-fit items-center justify-start gap-1",
}

const listOrientationMap: Record<TabsOrientation, string> = {
  horizontal: "",
  vertical: "flex-col items-stretch h-fit",
}

export interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
  variant?: TabsVariant
  orientation?: TabsOrientation
}

function TabsList({
  className,
  variant = "pills",
  orientation = "horizontal",
  ...props
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(listVariantMap[variant], listOrientationMap[orientation], className)}
      {...props}
    />
  )
}

const triggerVariantMap: Record<TabsVariant, string> = {
  pills: [
    "data-[state=active]:bg-background",
    "data-[state=active]:text-foreground",
    "data-[state=active]:shadow-sm",
    "rounded-md px-2 py-1",
  ].join(" "),
  underline: [
    "data-[state=active]:text-foreground",
    "data-[state=active]:border-foreground",
    "border-b-2 border-transparent",
    "px-3 py-2",
    "-mb-px",
  ].join(" "),
  bordered: [
    "data-[state=active]:bg-background",
    "data-[state=active]:text-foreground",
    "data-[state=active]:border-border",
    "border border-transparent border-b-0",
    "rounded-t-lg px-3 py-2",
    "-mb-px",
  ].join(" "),
  ghost: [
    "data-[state=active]:text-foreground",
    "data-[state=active]:bg-secondary dark:data-[state=active]:bg-card",
    "rounded-md px-2 py-1",
    "h-full",
  ].join(" "),
}

export interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  variant?: TabsVariant
}

function TabsTrigger({
  className,
  variant = "pills",
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        focusRingClasses,
        triggerVariantMap[variant],
        className
      )}
      {...props}
    />
  )
}

// Radix gives the panel `tabIndex={0}` so a keyboard user can reach content that
// holds no focusable control of its own. That makes the panel a tab stop, and a
// tab stop with no indicator is a place a keyboard user lands blind — so it
// carries the same ring as the trigger that opened it.
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1", focusRingClasses, className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
