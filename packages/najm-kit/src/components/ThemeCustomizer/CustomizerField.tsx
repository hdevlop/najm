import * as React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import type { NButtonProps } from "../Button";

export interface CustomizerFieldProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  /** Place the label at the inline start of the control for compact rows. */
  layout?: "stacked" | "inline-start";
  /** Optional reset button. */
  onReset?: () => void;
  resetLabel?: React.ReactNode;
  resetAriaLabel?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}

export function CustomizerField({
  label,
  description,
  htmlFor,
  className,
  layout = "stacked",
  onReset,
  resetLabel,
  resetAriaLabel,
  disabled,
  children,
}: CustomizerFieldProps) {
  return (
    <div
      className={cn(
        "flex gap-1.5",
        layout === "inline-start"
          ? "flex-row items-center gap-2"
          : "flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          layout === "inline-start"
            ? "w-28 shrink-0 justify-start"
            : "justify-between",
        )}
      >
        <label
          htmlFor={htmlFor}
          className={cn(
            "min-w-0 text-xs font-medium text-muted-foreground",
            layout === "inline-start" && "truncate text-start",
          )}
          title={
            typeof label === "string" || typeof label === "number"
              ? String(label)
              : undefined
          }
        >
          {label}
        </label>
        {onReset ? (
          <ResetButton
            onClick={onReset}
            aria-label={
              typeof resetAriaLabel === "string" || typeof resetAriaLabel === "number"
                ? String(resetAriaLabel)
                : typeof resetLabel === "string" || typeof resetLabel === "number"
                  ? String(resetLabel)
                  : "Reset field"
            }
            title={
              typeof resetLabel === "string" || typeof resetLabel === "number"
                ? String(resetLabel)
                : "Reset"
            }
            disabled={disabled}
          />
        ) : null}
      </div>
      <div className={cn(layout === "inline-start" && "min-w-0 flex-1")}>
        {children}
      </div>
      {description ? (
        <p className="text-[11px] leading-snug text-muted-foreground/80">
          {description}
        </p>
      ) : null}
    </div>
  );
}

interface ResetButtonProps
  extends Omit<NButtonProps, "size" | "variant" | "asChild"> {
  onClick?: () => void;
}

function ResetButton({
  onClick,
  disabled,
  className,
  ...rest
}: ResetButtonProps) {
  return (
    <NButton
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      {...rest}
    >
      <RotateCcw className="size-3" />
    </NButton>
  );
}
