import React, { useState, useEffect } from "react";
import { cn } from "../../lib/cn";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import type { TabsVariant, TabsOrientation } from "../ui/tabs";
import { TAB_COLORS, type NTabsColor } from "./tabColors";
import { NIcon, type NIconSource } from "../Icon";

export type NTabsItem<V extends string = string> = {
  value: V;
  label: React.ReactNode;
  icon?: NIconSource;
  content: React.ReactNode;
  disabled?: boolean;
};

export type NTabsClassNames = {
  root?: string;
  list?: string;
  trigger?: string;
  content?: string;
};

export type NTabsStyles = {
  root?: React.CSSProperties;
  list?: React.CSSProperties;
  trigger?: React.CSSProperties;
  activeTrigger?: React.CSSProperties;
  content?: React.CSSProperties;
};

export interface NTabsProps<V extends string = string> {
  items: NTabsItem<V>[];
  defaultValue?: V;
  value?: V;
  onValueChange?: (value: V) => void;
  variant?: TabsVariant;
  orientation?: TabsOrientation;
  color?: NTabsColor;
  accentColor?: string;
  fullWidth?: boolean;
  className?: string;
  classNames?: NTabsClassNames;
  styles?: NTabsStyles;
}

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function accentStyles(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    list:          { backgroundColor: `rgba(${r},${g},${b},0.12)` },
    trigger:       { color: `rgba(${r},${g},${b},0.7)` },
    activeTrigger: { backgroundColor: hex, color: luminance > 0.55 ? "#1e293b" : "#ffffff" },
  };
}

export function NTabs<V extends string = string>({
  items,
  defaultValue,
  value,
  onValueChange,
  variant = "pills",
  orientation = "horizontal",
  color = "default",
  accentColor,
  fullWidth = false,
  className,
  classNames,
  styles,
}: NTabsProps<V>) {
  const preset = TAB_COLORS[color];
  const activeClass = `data-[state=active]:${preset.active}`;
  const isHorizontal = orientation === "horizontal";

  const [currentValue, setCurrentValue] = useState<string>(
    value ?? defaultValue ?? items[0]?.value ?? "",
  );

  useEffect(() => {
    if (value !== undefined) setCurrentValue(value);
  }, [value]);

  const handleChange = (v: string) => {
    setCurrentValue(v);
    onValueChange?.(v as V);
  };

  const derived = accentColor ? accentStyles(accentColor) : null;
  const listStyle    = variant === "ghost" || variant === "bordered" ? styles?.list : (derived?.list ?? styles?.list);
  const triggerStyle = derived?.trigger ?? styles?.trigger;
  const activeStyle  = derived
    ? variant === "bordered"
      ? { borderColor: accentColor, color: accentColor }
      : derived.activeTrigger
    : styles?.activeTrigger;

  return (
    <Tabs
      value={value}
      defaultValue={defaultValue}
      onValueChange={handleChange}
      variant={variant}
      orientation={orientation}
      className={classNames?.root}
      style={styles?.root}
    >
      <TabsList
        variant={variant}
        orientation={orientation}
        className={cn(
          !accentColor && variant === "pills" && preset.list,
          fullWidth && isHorizontal && "w-full",
          classNames?.list,
          className,
        )}
        style={listStyle}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            variant={variant}
            disabled={item.disabled}
            className={cn(
              !accentColor && activeClass,
              fullWidth && isHorizontal && "flex-1",
              classNames?.trigger,
            )}
            style={{
              ...triggerStyle,
              ...(currentValue === item.value ? activeStyle : {}),
            }}
          >
            {item.icon && <NIcon icon={item.icon} size={14} />}
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) =>
        item.content != null ? (
          <TabsContent
            key={item.value}
            value={item.value}
            className={classNames?.content}
            style={styles?.content}
          >
            {item.content}
          </TabsContent>
        ) : null
      )}
    </Tabs>
  );
}
