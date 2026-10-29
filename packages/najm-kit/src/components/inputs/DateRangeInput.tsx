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
import type { DateRangeInputProps } from "./types";

// Local date parts, as DateInput: toISOString() would shift a local-midnight
// day to UTC, a day earlier in GMT+ zones.
const toDateString = (date: Date) => format(date, "yyyy-MM-dd");

// An empty form value ("") or an unparseable one is no date, not Invalid Date.
const toDate = (val: Date | string | undefined | null) => {
  const date = typeof val === "string" ? (val ? parseISO(val) : undefined) : val ?? undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

const ordered = (a: Date, b: Date) => (b < a ? { from: b, to: a } : { from: a, to: b });

export const DateRangeInput: React.FC<DateRangeInputProps> = ({ value, onChange, placeholder, className = "", icon, showIcon = true, iconColor, variant = "default", status = "default", bordered, borderColor, ariaLabel, min, max, numberOfMonths = 2 }) => {
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const locale = useNajmFormatContext()?.locale;
  const labels = useNajmKitLabels();
  const [open, setOpen] = React.useState(false);
  // The first day clicked starts a new range and is held here until the second
  // completes it, so the form never holds half a range. Meanwhile the hovered
  // or focused day previews where the range would end.
  const [anchor, setAnchor] = React.useState<Date>();
  const [hovered, setHovered] = React.useState<Date>();

  const range = value && typeof value === "object" ? value : undefined;
  const from = toDate(range?.from);
  const to = toDate(range?.to);
  const committed = from ? { from, to } : undefined;
  const selected = anchor ? (hovered ? ordered(anchor, hovered) : { from: anchor, to: anchor }) : committed;
  const shown = anchor ? { from: anchor, to: undefined } : committed;

  const toLabel = (date: Date) => (locale ? formatCalendarDate(date, locale, "medium") : format(date, "PP"));
  const label = !shown
    ? placeholder ?? labels.pickDateRange
    : shown.to && toDateString(shown.to) !== toDateString(shown.from)
      ? `${toLabel(shown.from)} – ${toLabel(shown.to)}`
      : shown.to ? toLabel(shown.from) : `${toLabel(shown.from)} – …`;

  const minDate = toDate(min);
  const maxDate = toDate(max);
  const disabled = [minDate && { before: minDate }, maxDate && { after: maxDate }].filter(Boolean) as Array<{ before: Date } | { after: Date }>;
  const today = new Date();
  const openOn = from ?? (minDate && today < minDate ? minDate : maxDate && today > maxDate ? maxDate : undefined);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setAnchor(undefined);
    setHovered(undefined);
  };

  const pick = (day: Date) => {
    if (!anchor) {
      setAnchor(day);
      setHovered(undefined);
      return;
    }
    const chosen = ordered(anchor, day);
    onChange({ from: toDateString(chosen.from), to: toDateString(chosen.to) });
    handleOpenChange(false);
  };
  const preview = (day: Date) => {
    if (anchor) setHovered(day);
  };

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={className}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {/* A real button, not a div, for the same reasons as DateInput's trigger. */}
          <button type="button" aria-label={ariaLabel} className="w-full flex items-center cursor-pointer gap-2 justify-start text-left font-normal bg-transparent border-0 p-0 outline-none">
            <span className={cn("flex-1 truncate text-sm cursor-pointer", shown ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(_range: unknown, day: Date) => pick(day)}
            onDayMouseEnter={preview}
            onDayFocus={preview}
            numberOfMonths={numberOfMonths}
            disabled={disabled.length ? disabled : undefined}
            defaultMonth={openOn}
            startMonth={minDate}
            endMonth={maxDate}
          />
        </PopoverContent>
      </Popover>
      {!icon && showIcon && <CalendarIcon className={iconProps.className} style={iconProps.style} />}
    </BaseInput>
  );
};
