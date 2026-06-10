import * as React from "react";
import { cn } from "../../lib/cn";

export type StatusPillTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusPillTone;
  pulse?: boolean;
  label: React.ReactNode;
}

const toneClasses: Record<StatusPillTone, { dot: string; text: string; ring: string }> = {
  neutral: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "border-white/10",
  },
  success: {
    dot: "bg-emerald-500",
    text: "text-emerald-500",
    ring: "border-emerald-500/30",
  },
  warning: {
    dot: "bg-amber-500",
    text: "text-amber-500",
    ring: "border-amber-500/30",
  },
  danger: {
    dot: "bg-red-500",
    text: "text-red-500",
    ring: "border-red-500/30",
  },
  info: {
    dot: "bg-sky-500",
    text: "text-sky-500",
    ring: "border-sky-500/30",
  },
  brand: {
    dot: "bg-primary",
    text: "text-primary",
    ring: "border-primary/30",
  },
};

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, tone = "neutral", pulse = false, label, ...props }, ref) => {
    const c = toneClasses[tone];
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border bg-white/5 px-2 py-0.5 text-[11px] font-medium",
          c.ring,
          c.text,
          className
        )}
        {...props}
      >
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                c.dot
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", c.dot)} />
        </span>
        {label}
      </span>
    );
  }
);
StatusPill.displayName = "StatusPill";
