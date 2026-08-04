import type React from "react";
import { cn } from "../../lib/cn";
import { surfaceBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
import { DEFAULT_TABLE_BORDER_COLOR, resolveTableColor } from "./tableColors";

export function useTableSurfaceAppearance(bordered?: boolean, borderColor?: string) {
  const recipe = useNajmComponentStyle("table");
  const recipeRadius = resolveRadiusValue(recipe?.radius);
  const resolvedBorderColor = resolveTableColor(borderColor, DEFAULT_TABLE_BORDER_COLOR);
  const style: React.CSSProperties | undefined =
    recipeRadius || (bordered !== false && (recipe?.borderWidth || borderColor))
      ? {
          ...(recipeRadius ? { borderRadius: recipeRadius } : {}),
          ...(bordered !== false && recipe?.borderWidth ? { borderWidth: recipe.borderWidth } : {}),
          ...(bordered !== false && borderColor ? { borderColor: resolvedBorderColor } : {}),
        }
      : undefined;

  return {
    bordered,
    style,
    className: cn(
      "bg-card",
      bordered === true ? surfaceBorderClasses(true) : "border-0 shadow-sm",
    ),
  };
}
