import React from "react";
import { cn } from "../../lib/cn";
import { cva } from "class-variance-authority";
import { inputBorderColorClassForDegree, useResolvedBorderDegree } from "../../theme/borders";
import type { NajmBorderDegree } from "../../theme/types";
import type { TailwindColor } from "./types";

interface BaseInputProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "rounded" | "ghost";
  status?: "default" | "error";
  bordered?: boolean;
  borderDegree?: NajmBorderDegree;
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
  "relative w-full flex items-center h-10 bg-card overflow-hidden transition-colors",
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
  ({ children, variant = "default", status = "default", bordered, borderDegree, borderColor, className, disabled = false, onHover, onClick, hasIcon, ...rest }, ref) => {
    const isGhost = variant === "ghost";
    const isError = status === "error";
    const resolvedBorderDegree = useResolvedBorderDegree({
      borderDegree,
      bordered,
      fallback: "default",
    });
    const hasExplicitColor = !!borderColor;

    let colorClass = "";
    let borderClass = "";

    if (!isGhost) {
      if (isError) {
        borderClass = ERROR_BORDER;
      } else if (hasExplicitColor) {
        borderClass = `${STATIC_BASE} ${FOCUS_INTERACTIVE_BASE} ${HOVER_INTERACTIVE_BASE}`;
        colorClass = PRESETS[borderColor!] ?? (NO_SHADE.has(borderColor!) ? `border-${borderColor!}` : `border-${borderColor!}-600`);
      } else {
        const restingBorderClass = inputBorderColorClassForDegree(resolvedBorderDegree);
        borderClass = resolvedBorderDegree === "default"
          ? `${STATIC_BASE} ${restingBorderClass} hover:border-input focus-within:border-primary/70`
          : `${STATIC_BASE} ${restingBorderClass} focus-within:border-primary/70`;
      }
    }

    return (
      <div
        ref={ref}
        data-border-degree={isGhost ? undefined : resolvedBorderDegree}
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
