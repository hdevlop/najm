import React, { useMemo } from "react";
import { ComboboxInput } from "./ComboboxInput";
import type { SelectItemType, TimeZoneInputProps } from "./types";
import { NAJM_TIME_ZONES } from "../../lib/timeZones";

const timeZoneFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  timeZoneName: "longOffset",
});

function getTimeZoneLabel(timeZone: string): string {
  const offset = new Intl.DateTimeFormat(timeZoneFormatter.resolvedOptions().locale, {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return `${timeZone} (${offset})`;
}

const timeZones: SelectItemType[] = NAJM_TIME_ZONES.map((value) => ({
  value,
  label: getTimeZoneLabel(value),
}));

export const TimeZoneInput: React.FC<TimeZoneInputProps> = ({
  value = "",
  onChange,
  items = timeZones,
  placeholder = "Select time zone",
  disabled = false,
  ...props
}) => {
  const localizedItems = useMemo(
    () => items.map((item) => ({ ...item, label: item.label || getTimeZoneLabel(item.value) })),
    [items],
  );

  return (
    <ComboboxInput
      {...props}
      value={value}
      onChange={onChange}
      items={localizedItems}
      placeholder={placeholder}
      searchPlaceholder="Search time zones..."
      emptyMessage="No time zone found"
      showIcon={false}
      disabled={disabled}
    />
  );
};

export { timeZones };
