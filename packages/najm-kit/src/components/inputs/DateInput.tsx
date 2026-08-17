import React from "react";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps } from "./utils";
import type { DateInputProps } from "./types";

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, placeholder = "Pick a date", className = "", icon, showIcon = true, iconColor, variant = "default", status = "default", bordered, borderColor, ariaLabel }) => {
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  // Serialize using local date parts, not toISOString() — the calendar returns a
  // local-midnight Date, and toISOString() shifts it to UTC (a day earlier in GMT+ zones).
  const toDateString = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : undefined);
  // Parse "yyyy-MM-dd" as a local date; native new Date() would read it as UTC midnight.
  const toDate = (val: Date | string | undefined) => (typeof val === "string" ? parseISO(val) : val);

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={className}>
      <Popover>
        <PopoverTrigger asChild>
          {/*
            A button, not a div: Radix only merges its trigger props onto the child,
            so a div came out of `asChild` with no role, no tab stop, and no keyboard
            activation. `type="button"` keeps it from submitting the surrounding form
            when the calendar opens.
          */}
          <button type="button" aria-label={ariaLabel} className="w-full flex items-center cursor-pointer gap-2 justify-start text-left font-normal bg-transparent border-0 p-0 outline-none">
            <span className={cn("cursor-pointer", value ? "text-foreground" : "text-muted-foreground")}>
              {value ? format(toDate(value)!, "PPP") : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={toDate(value)} onSelect={(date) => onChange(toDateString(date))} captionLayout="dropdown" />
        </PopoverContent>
      </Popover>
      {!icon && showIcon && <CalendarIcon className={iconProps.className} style={iconProps.style} />}
    </BaseInput>
  );
};
