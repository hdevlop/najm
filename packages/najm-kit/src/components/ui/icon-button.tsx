import * as React from "react";
import { cn } from "../../lib/cn";

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Required for accessibility — icon-only buttons must have a label. */
  "aria-label": string;
  active?: boolean;
}

const variantClasses: Record<IconButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-transparent text-destructive hover:bg-destructive/10",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "ghost",
      size = "md",
      active = false,
      type = "button",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={active || undefined}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          active && "bg-accent text-accent-foreground",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
