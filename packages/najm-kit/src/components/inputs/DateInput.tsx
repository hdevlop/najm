import React from "react";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps } from "./utils";
import { formatCalendarDate } from "../../lib/localeDates";
import { useNajmFormatContext } from "../../format/provider";
import { useNajmKitLabels } from "../../lib/kitLabels";
import type { DateInputProps } from "./types";

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, placeholder, className = "", icon, showIcon = true, iconColor, variant = "default", status = "default", bordered, borderColor, ariaLabel, min, max }) => {
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  // Serialize using local date parts, not toISOString() — the calendar returns a
  // local-midnight Date, and toISOString() shifts it to UTC (a day earlier in GMT+ zones).
  const toDateString = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : undefined);
  // Parse "yyyy-MM-dd" as a local date; native new Date() would read it as UTC midnight.
  // An empty form value ("") or an unparseable one is no date, not Invalid Date,
  // which the calendar cannot open on.
  const toDate = (val: Date | string | undefined | null) => {
    const date = typeof val === "string" ? (val ? parseISO(val) : undefined) : val ?? undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  };
  // The label follows the active locale; outside a format provider it keeps
  // date-fns' English "PPP".
  const locale = useNajmFormatContext()?.locale;
  const labels = useNajmKitLabels();
  // Choosing a day is the whole interaction, so it closes the calendar; it
  // stayed open over the form until Escape or a click outside.
  const [open, setOpen] = React.useState(false);
  const toLabel = (date: Date) => (locale ? formatCalendarDate(date, locale) : format(date, "PPP"));
  // A bound keeps the calendar to the days the form accepts, and opens it on
  // the first allowed month when today lies outside them.
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const disabled = [minDate && { before: minDate }, maxDate && { after: maxDate }].filter(Boolean) as Array<{ before: Date } | { after: Date }>;
  const today = new Date();
  const selected = toDate(value);
  const openOn = selected ?? (minDate && today < minDate ? minDate : maxDate && today > maxDate ? maxDate : undefined);

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/*
            A button, not a div: Radix only merges its trigger props onto the child,
            so a div came out of `asChild` with no role, no tab stop, and no keyboard
            activation. `type="button"` keeps it from submitting the surrounding form
            when the calendar opens.
          */}
          <button type="button" aria-label={ariaLabel} className="w-full flex items-center cursor-pointer gap-2 justify-start text-left font-normal bg-transparent border-0 p-0 outline-none">
            <span className={cn("flex-1 truncate text-sm cursor-pointer", selected ? "text-foreground" : "text-muted-foreground")}>
              {selected ? toLabel(selected) : placeholder ?? labels.pickDate}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selected} onSelect={(date) => { onChange(toDateString(date)); setOpen(false); }} captionLayout="dropdown" disabled={disabled.length ? disabled : undefined} defaultMonth={openOn} startMonth={minDate} endMonth={maxDate} />
        </PopoverContent>
      </Popover>
      {!icon && showIcon && <CalendarIcon className={iconProps.className} style={iconProps.style} />}
    </BaseInput>
  );
};
