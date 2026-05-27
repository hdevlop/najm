import React from "react";
import { cn } from "../../lib/cn";

export function getIconColorProps(iconColor?: string, baseClassName = "") {
  if (!iconColor) return { className: cn(baseClassName, "text-muted-foreground"), style: {} };
  if (iconColor.startsWith("text-")) return { className: cn(baseClassName, iconColor), style: {} };
  return { className: baseClassName, style: { color: iconColor } };
}

export function resolveIcon(icon: any): React.ReactNode {
  if (!icon) return null;
  if (typeof icon === "string") {
    return React.createElement("span", { className: "text-xs font-medium" }, icon.charAt(0).toUpperCase());
  }
  return icon;
}
