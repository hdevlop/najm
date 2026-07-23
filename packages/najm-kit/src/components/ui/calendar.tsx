import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "../../lib/cn"
import { buttonVariants } from "../Button"

function Calendar(props: Record<string, any>) {
  const { className, classNames, mode = "single", ...rest } = props
  return (
    <DayPicker
      mode={mode}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        dropdowns: "relative inline-flex items-center gap-2",
        dropdown_root: "relative inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground hover:bg-accent",
        dropdown: "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0",
        nav: "flex items-center gap-1",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"),
        month_grid: "w-full border-collapse space-x-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
        day_button: "size-8 p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation = "left" }: { className?: string; orientation?: "up" | "down" | "left" | "right" }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeftIcon
              : orientation === "right"
                ? ChevronRightIcon
                : orientation === "up"
                  ? ChevronUpIcon
                  : ChevronDownIcon
          return <Icon className="size-4" />
        },
      }}
      className={cn("p-3", className)}
      {...rest}
    />
  )
}

export { Calendar }
