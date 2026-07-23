import React from "react";
import { cn } from "../../lib/cn";
import { cva } from "class-variance-authority";
import { inputBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
import type { TailwindColor } from "./types";

interface BaseInputProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "rounded" | "ghost";
  status?: "default" | "error";
  bordered?: boolean;
  borderColor?: TailwindColor;
  hasIcon?: boolean;
  disabled?: boolean;
  onHover?: () => void;
}

const NO_SHADE = new Set(["black", "white"]);

const PRESETS: Record<string, string> = {
  muted: "border-muted-foreground",
  primary: "border-primary",
  accent: "border-accent",
  success: "border-green-600",
  warning: "border-amber-600",
  destructive: "border-red-600",
};

const inputVariants = cva(
  "relative w-full flex items-center h-10 bg-card text-foreground overflow-hidden transition-colors",
  {
    variants: {
      variant: {
        default: "p-2 rounded-md",
        rounded: "p-2 rounded-full",
        ghost: "p-0! !bg-transparent !bg-none",
      },
      status: {
        default: "",
        error: "",
      },
      hasIcon: { true: "pl-8", false: "pl-3" },
      disabled: { true: "cursor-not-allowed", false: "" },
    },
    defaultVariants: { variant: "default", status: "default", hasIcon: false, disabled: false },
  }
);

const ERROR_BORDER = "border !border-red-600";
const FOCUS_INTERACTIVE_BASE = "border focus-within:border-primary";
const HOVER_INTERACTIVE_BASE = "hover:border-primary";
const STATIC_BASE = "border";

export const BaseInput = React.forwardRef<HTMLDivElement, BaseInputProps>(
  ({ children, variant = "default", status = "default", bordered, borderColor, className, style, disabled = false, onHover, onClick, hasIcon, ...rest }, ref) => {
    const recipe = useNajmComponentStyle("input");
    const isGhost = variant === "ghost";
    const isError = status === "error";
    const hasExplicitColor = !!borderColor;
    const isBordered = bordered !== false;
    const recipeRadius = variant === "default" ? resolveRadiusValue(recipe?.radius) : undefined;

    let colorClass = "";
    let borderClass = "";

    if (!isGhost) {
      if (isError) {
        borderClass = ERROR_BORDER;
      } else if (hasExplicitColor) {
        borderClass = `${STATIC_BASE} ${FOCUS_INTERACTIVE_BASE} ${HOVER_INTERACTIVE_BASE}`;
        colorClass = PRESETS[borderColor!] ?? (NO_SHADE.has(borderColor!) ? `border-${borderColor!}` : `border-${borderColor!}-600`);
      } else {
        const restingBorderClass = inputBorderClasses(isBordered);
        borderClass = isBordered
          ? `${STATIC_BASE} ${restingBorderClass} hover:border-input focus-within:border-primary/70`
          : restingBorderClass;
      }
    }

    return (
      <div
        ref={ref}
        data-bordered={!isGhost && !isBordered ? "false" : !isGhost ? "true" : undefined}
        style={recipeRadius ? { borderRadius: recipeRadius, ...style } : style}
        className={cn(
          inputVariants({ variant, status, hasIcon, disabled }),
          !isGhost && borderClass,
          !isGhost && colorClass,
          className
        )}
        onMouseEnter={disabled ? undefined : onHover}
        onClick={disabled ? undefined : onClick}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
BaseInput.displayName = "BaseInput";
