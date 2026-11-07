import React from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import { useNajmKitLabels, type NajmKitLabels } from "../../lib/kitLabels";
import type { TimeRangeInputProps } from "./types";

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
// A stored "08:30:00" reads as "08:30"; anything else is no time.
const readClock = (value: unknown) => (typeof value === "string" && CLOCK.test(value.slice(0, 5)) ? value.slice(0, 5) : undefined);

/** "1h", "1h30", "45 min". */
export function formatTimeRangeDuration(minutes: number, labels: Pick<NajmKitLabels, "hourShort" | "minuteShort">) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (!hours) return `${rest} ${labels.minuteShort}`;
  return `${hours}${labels.hourShort}${rest ? String(rest).padStart(2, "0") : ""}`;
}

/**
 * A start and an end time in one field, as DateRangeInput is for days: the
 * trigger reads "08:30 – 09:30 · 1h", and its popover offers the start times
 * and the end times side by side, with the usual lengths as one click.
 *
 * Picking a start keeps the end when it is still later, otherwise sets it
 * `defaultDuration` after, so the value always holds both times or neither.
 */
export const TimeRangeInput: React.FC<TimeRangeInputProps> = ({ value, onChange, placeholder, className = "", icon, showIcon = true, iconColor, variant = "default", status = "default", bordered, borderColor, ariaLabel, disabled = false, step = 15, min = "07:00", max = "19:00", durations = [30, 45, 60, 90, 120], defaultDuration = 60, clearable = true }) => {
  const labels = useNajmKitLabels();
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const [open, setOpen] = React.useState(false);
  const lists = React.useRef<HTMLDivElement>(null);

  const range = value && typeof value === "object" ? value : undefined;
  const from = readClock(range?.from);
  const to = readClock(range?.to);
  const complete = from && to && toMinutes(to) > toMinutes(from) ? { from, to } : undefined;

  const first = toMinutes(readClock(min) ?? "00:00"), last = toMinutes(readClock(max) ?? "23:59");
  const times = React.useMemo(() => {
    const list: string[] = [];
    for (let minutes = first; minutes <= last; minutes += Math.max(step, 1)) list.push(toClock(minutes));
    return list;
  }, [first, last, step]);
  // A stored time off the step stays offered, so it shows as chosen.
  const withStored = (list: string[], time?: string) => (time && !list.includes(time) ? [...list, time].sort() : list);
  const starts = withStored(times.slice(0, -1), from);
  const ends = withStored(times.slice(1), to);

  const endAfter = (start: string, minutes: number) => toClock(Math.min(toMinutes(start) + minutes, Math.max(last, toMinutes(start) + 1)));
  const pickStart = (start: string) => onChange({ from: start, to: to && toMinutes(to) > toMinutes(start) ? to : endAfter(start, defaultDuration) });
  const pickEnd = (end: string) => { if (from) { onChange({ from, to: end }); setOpen(false); } };
  const pickLength = (minutes: number) => { if (from) { onChange({ from, to: endAfter(from, minutes) }); setOpen(false); } };
  const clear = () => { onChange({}); setOpen(false); };

  // Opening shows the chosen times, not the top of each list.
  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => lists.current?.querySelectorAll<HTMLElement>("[aria-pressed='true']").forEach(option => option.scrollIntoView?.({ block: "center" })));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const length = complete ? toMinutes(complete.to) - toMinutes(complete.from) : undefined;
  const label = complete ? `${complete.from} – ${complete.to}` : placeholder ?? labels.pickTimeRange;
  const option = (time: string, pressed: boolean, onPick: () => void, off = false) => (
    <button key={time} type="button" aria-pressed={pressed} disabled={off} onClick={onPick}
      className={cn("w-full rounded-md px-3 py-1.5 text-start text-sm tabular-nums outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40",
        pressed && "bg-primary text-primary-foreground hover:bg-primary focus-visible:bg-primary")}>{time}</button>
  );

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={ariaLabel} disabled={disabled} className="flex w-full cursor-pointer items-center justify-start gap-2 border-0 bg-transparent p-0 text-left font-normal outline-none disabled:cursor-not-allowed disabled:opacity-60">
            {showIcon && (icon ? <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span> : <Clock className={iconProps.className} style={iconProps.style} />)}
            <span className={cn("flex-1 truncate text-sm tabular-nums", complete ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {length !== undefined && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{formatTimeRangeDuration(length, labels)}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div ref={lists} className="grid grid-cols-2 gap-2">
            <div role="group" aria-label={labels.timeFrom} className="min-w-0">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{labels.timeFrom}</p>
              <div className="max-h-56 overflow-y-auto pe-1">{starts.map(time => option(time, time === from, () => pickStart(time)))}</div>
            </div>
            <div role="group" aria-label={labels.timeTo} className="min-w-0 border-s ps-2">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{labels.timeTo}</p>
              <div className="max-h-56 overflow-y-auto pe-1">{ends.map(time => option(time, time === to, () => pickEnd(time), !from || toMinutes(time) <= toMinutes(from)))}</div>
            </div>
          </div>
          {(durations.length > 0 || clearable) && <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
            {durations.map(minutes => (
              <button key={minutes} type="button" aria-pressed={length === minutes} disabled={!from} onClick={() => pickLength(minutes)}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs tabular-nums transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40", length === minutes && "border-primary bg-primary/10 text-primary")}>
                {formatTimeRangeDuration(minutes, labels)}
              </button>
            ))}
            {clearable && <button type="button" disabled={!complete} onClick={clear} className="ms-auto rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40">{labels.noTime}</button>}
          </div>}
        </PopoverContent>
      </Popover>
    </BaseInput>
  );
};
