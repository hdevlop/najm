import React from "react";
import { cn } from "../../lib/cn";
import { NIcon } from "../Icon";
import type { InputIcon } from "./types";

export function getIconColorProps(iconColor?: string, baseClassName = "") {
  if (!iconColor) return { className: cn(baseClassName, "text-muted-foreground"), style: {} };
  if (iconColor.startsWith("text-")) return { className: cn(baseClassName, iconColor), style: {} };
  return { className: baseClassName, style: { color: iconColor } };
}

export function resolveIcon(icon?: InputIcon): React.ReactNode {
  if (!icon) return null;
  return <NIcon icon={icon as any} size={16} />;
}
