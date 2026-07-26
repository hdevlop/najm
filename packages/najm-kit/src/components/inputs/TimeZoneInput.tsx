import React, { useMemo } from "react";
import { ComboboxInput } from "./ComboboxInput";
import type { SelectItemType, TimeZoneInputProps } from "./types";

const timeZoneValues = [
  "UTC",
  "Atlantic/Azores",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

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

const timeZones: SelectItemType[] = timeZoneValues.map((value) => ({
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
