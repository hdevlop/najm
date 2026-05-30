import React from "react";
import { cn } from "../../lib/cn";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export type NStatCardVariant = "default" | "usage";

// ── kept for backward-compat (not used by new variants)
export interface NStatCardClassNames {
  root?: string;
  icon?: string;
  label?: string;
  value?: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────
// Shared props
// ─────────────────────────────────────────────────────────────

interface BaseProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  classNames?: NStatCardClassNames;
}

// ── default variant (RAG / WA style) ──────────────────────────

interface DefaultProps extends BaseProps {
  variant?: "default";
  value: string | number;
  subtext?: string;
  change?: { value: string; positive: boolean };
  // usage-only — not accepted
  iconColor?: never;
  iconBgColor?: never;
  accentColor?: never;
  count?: never;
  countLabel?: never;
  used?: never;
  total?: never;
}

// ── usage variant (Storage style) ────────────────────────────

interface UsageProps extends BaseProps {
  variant: "usage";
  count: number;
  used: number;
  total: number;
  iconColor?: string;
  iconBgColor?: string;
  accentColor?: string;
  countLabel?: string;
  // default-only — not accepted
  value?: never;
  subtext?: never;
  change?: never;
}

export type NStatCardProps = DefaultProps | UsageProps;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return i === 0 ? `${Math.round(v)} B` : `${v.toFixed(1)} ${units[i]}`;
}

// ─────────────────────────────────────────────────────────────
// Default variant
// ─────────────────────────────────────────────────────────────

function DefaultCard({
  icon: Icon,
  label,
  value,
  subtext,
  change,
  onClick,
  className,
  classNames,
}: DefaultProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors",
        onClick && "cursor-pointer hover:border-border/60 hover:bg-accent/40",
        classNames?.root,
        className,
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20",
          classNames?.icon,
        )}
      >
        <Icon size={28} strokeWidth={1.75} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-xs text-muted-foreground", classNames?.label)}>{label}</p>
          {change && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                change.positive
                  ? "bg-green-500/10 text-green-500"
                  : "bg-red-500/10 text-red-500",
              )}
            >
              {change.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {change.value}
            </span>
          )}
        </div>
        <p className={cn("text-2xl font-semibold leading-none text-foreground", classNames?.value)}>
          {value}
        </p>
        {subtext && (
          <p className={cn("text-[10px] text-muted-foreground", classNames?.description)}>{subtext}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Usage variant
// ─────────────────────────────────────────────────────────────

function UsageCard({
  icon: Icon,
  label,
  count,
  used,
  total,
  iconColor,
  iconBgColor,
  accentColor,
  countLabel,
  onClick,
  className,
  classNames,
}: UsageProps) {
  const pct = total > 0 ? Math.min(Math.max((used / total) * 100, 0), 100) : 0;
  const itemLabel = countLabel ?? (count === 1 ? "Item" : "Items");

  return (
    <div
      onClick={onClick}
      className={cn(
        "group min-h-[116px] rounded-[10px] border border-border bg-card px-4 py-4 transition-colors",
        onClick && "cursor-pointer hover:bg-accent/30",
        classNames?.root,
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition-opacity group-hover:opacity-90",
            classNames?.icon,
          )}
          style={{ backgroundColor: iconBgColor ?? (accentColor ? `${accentColor}24` : undefined) }}
        >
          <Icon size={19} strokeWidth={2.25} className={iconColor ?? "text-primary"} />
        </div>
        <div className="min-w-0">
          <div className={cn("truncate text-[13px] font-semibold leading-4 text-foreground", classNames?.label)}>
            {label}
          </div>
          <div className="mt-1 text-[10px] leading-3 text-muted-foreground">
            {count.toLocaleString()} {itemLabel}
          </div>
        </div>
      </div>

      <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-border/40">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: accentColor ?? "hsl(var(--primary))" }}
        />
      </div>

      <div className={cn("mt-3 text-[10px] leading-none text-muted-foreground", classNames?.description)}>
        {formatBytes(used)} of {formatBytes(total)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────────

export function NStatCard(props: NStatCardProps) {
  if (props.variant === "usage") return <UsageCard {...props} />;
  return <DefaultCard {...(props as DefaultProps)} />;
}
