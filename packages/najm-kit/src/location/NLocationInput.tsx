"use client";

import React from "react";
import { CircleAlert, MapPin, MapPinCheck } from "lucide-react";
import { BaseInput } from "../components/inputs/BaseInput";
import { IconButton } from "../components/ui/icon-button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";
import { isCompleteCoordinatePair, normalizeLocationValue } from "./contracts";
import { NLocationDialog } from "./NLocationDialog";
import { useNLocationProvider } from "./provider";
import type { NLocationInputProps } from "./types";

export const NLocationInput = React.forwardRef<HTMLInputElement, NLocationInputProps>(function NLocationInput({
  value,
  onChange,
  labels: labelOverrides,
  classNames,
  status = "default",
  bordered,
  className,
  disabled = false,
  readOnly = false,
  ...inputProps
}, ref) {
  const provider = useNLocationProvider();
  const labels = React.useMemo(() => ({ ...provider.labels, ...labelOverrides }), [labelOverrides, provider.labels]);
  const normalized = normalizeLocationValue(value);
  const hasPin = isCompleteCoordinatePair(normalized);
  const [open, setOpen] = React.useState(false);
  const [pinnedAddress, setPinnedAddress] = React.useState(() => hasPin ? normalized.address : "");
  const coordinateKey = hasPin ? `${normalized.latitude}:${normalized.longitude}` : "";
  const pinnedCoordinateKey = React.useRef(coordinateKey);

  React.useEffect(() => {
    if (coordinateKey === pinnedCoordinateKey.current) return;
    pinnedCoordinateKey.current = coordinateKey;
    setPinnedAddress(hasPin ? normalized.address : "");
  }, [coordinateKey, hasPin, normalized.address]);

  const changedAfterPin = hasPin && pinnedAddress !== "" && pinnedAddress !== normalized.address;
  const mapAvailable = Boolean(provider.adapter);
  const stateLabel = !mapAvailable
    ? provider.unavailableReason || labels.unavailable
    : changedAfterPin
      ? labels.changedAfterPin
      : hasPin
        ? labels.selected
        : labels.notSelected;
  const StateIcon = !mapAvailable || changedAfterPin ? CircleAlert : hasPin ? MapPinCheck : MapPin;

  return (
    <div className={cn("grid gap-1.5", classNames?.root)}>
      <BaseInput status={status} bordered={bordered} disabled={disabled} className={cn("gap-2", classNames?.input, className)}>
        <Input
          {...inputProps}
          ref={ref}
          value={normalized.address}
          onChange={(event) => onChange({ ...normalized, address: event.target.value })}
          disabled={disabled}
          readOnly={readOnly}
          className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <IconButton
          aria-label={labels.openMap}
          variant="ghost"
          size="md"
          disabled={disabled || readOnly || !mapAvailable}
          onClick={() => setOpen(true)}
        >
          <MapPin />
        </IconButton>
      </BaseInput>
      <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", changedAfterPin && "text-warning", classNames?.status)}>
        <StateIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {stateLabel}
      </p>
      <NLocationDialog
        open={open}
        value={normalized}
        onOpenChange={setOpen}
        onConfirm={(next) => { setPinnedAddress(next.latitude === null ? "" : next.address); onChange(next); }}
        labels={labelOverrides}
        classNames={classNames}
      />
    </div>
  );
});
