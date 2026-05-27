import React from "react";
import { cn } from "../../lib/cn";
import { cva } from "class-variance-authority";

interface BaseInputProps {
  children: React.ReactNode;
  variant?: "default" | "rounded" | "ghost";
  status?: "default" | "error";
  hasIcon?: boolean;
  className?: string;
  disabled?: boolean;
  onHover?: () => void;
  onClick?: () => void;
}

const inputVariants = cva(
  "relative w-full flex items-center border dark:bg-input/30 overflow-hidden bg-none",
  {
    variants: {
      variant: {
        default: "p-2 rounded-md",
        rounded: "p-2 rounded-full",
        ghost: "border-none p-0! !bg-transparent !bg-none",
      },
      status: {
        default: "border-muted-foreground/20",
        error: "border-2 border-red-500",
      },
      hasIcon: { true: "pl-8", false: "pl-3" },
      disabled: { true: "cursor-not-allowed", false: "" },
    },
    defaultVariants: { variant: "default", status: "default", hasIcon: false, disabled: false },
    compoundVariants: [
      { variant: ["default", "rounded"], disabled: false, class: "hover:border-primary dark:hover:bg-input/50" },
    ],
  }
);

export const BaseInput: React.FC<BaseInputProps> = ({ children, variant = "default", status = "default", hasIcon = false, className = "", disabled = false, onHover, onClick }) => (
  <div className={cn(inputVariants({ variant, status, hasIcon, disabled }), className)} onMouseEnter={disabled ? undefined : onHover} onClick={disabled ? undefined : onClick}>
    {children}
  </div>
);
