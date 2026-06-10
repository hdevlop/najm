import React from "react";
import { cn } from "../../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Label } from "../ui/label";
import { NAvatar } from "../Avatar/Avatar";
import type { LucideIcon } from "lucide-react";

// ─── Utilities ──────────────────────────────────────────────────────────────

export function truncateByCharacters(
  text: string,
  maxCharacters: number,
  suffix = "..."
): string {
  if (!text) return "";
  const str = String(text);
  return str.length <= maxCharacters ? str : str.slice(0, maxCharacters) + suffix;
}

// ─── NSectionInfo ────────────────────────────────────────────────────────────

export interface NSectionInfoProps {
  icon?: LucideIcon;
  label: string;
  value: string | React.ReactNode;
  valueColor?: string;
  iconColor?: string;
  className?: string;
  maxChars?: number;
}

export function NSectionInfo({
  icon: Icon,
  label = "",
  value = "",
  valueColor = "text-foreground",
  iconColor = "text-muted-foreground",
  className,
  maxChars = 12,
}: NSectionInfoProps) {
  const stringValue = String(value);
  const isTruncated = typeof value === "string" && stringValue.length > maxChars;
  const displayValue = isTruncated
    ? truncateByCharacters(stringValue, maxChars)
    : value;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {Icon && <Icon className={cn("w-4 h-4", iconColor)} />}
      <Label className="text-sm text-muted-foreground">{label}:</Label>
      {isTruncated ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Label className={cn("text-sm cursor-help", valueColor)}>
              {displayValue}
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{stringValue}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Label className={cn("text-sm", valueColor)}>{displayValue}</Label>
      )}
    </div>
  );
}

// ─── NSection ────────────────────────────────────────────────────────────────

export interface NSectionProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
  iconColor?: string;
  background?: string;
}

export function NSection({
  icon: Icon,
  title,
  children,
  className,
  iconColor = "text-blue-400",
  background = "bg-muted/40",
}: NSectionProps) {
  return (
    <div className={cn(background, "flex flex-col gap-1 rounded-lg p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-5 h-5", iconColor)} />
        <Label className="text-base font-medium text-foreground">{title}</Label>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// ─── NSectionWithInfo ────────────────────────────────────────────────────────

export interface NSectionWithInfoItem {
  icon?: LucideIcon;
  label: string;
  value: string | React.ReactNode;
  valueColor?: string;
  iconColor?: string;
}

export interface NSectionWithInfoProps extends Omit<NSectionProps, "children"> {
  items: NSectionWithInfoItem[];
}

export function NSectionWithInfo({
  icon,
  title,
  items,
  className,
  iconColor,
  background,
}: NSectionWithInfoProps) {
  return (
    <NSection
      icon={icon}
      title={title}
      className={className}
      iconColor={iconColor}
      background={background}
    >
      {items.map((item, index) => (
        <NSectionInfo
          key={`${item.label}-${index}`}
          icon={item.icon}
          label={item.label}
          value={item.value}
          valueColor={item.valueColor}
          iconColor={item.iconColor}
        />
      ))}
    </NSection>
  );
}

// ─── NSectionHeader ──────────────────────────────────────────────────────────

export interface NSectionHeaderProps {
  children: React.ReactNode;
  image?: string;
  showImage?: boolean;
  imageSize?: "sm" | "md" | "lg" | "xl";
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  background?: string;
  layout?: "horizontal" | "vertical";
}

export interface NSectionHeaderTitleProps {
  children: React.ReactNode;
  className?: string;
}

export interface NSectionHeaderSubtitleProps {
  children: React.ReactNode;
  className?: string;
}

export interface NSectionHeaderContentProps {
  children: React.ReactNode;
  className?: string;
}

export interface NSectionHeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

const ICON_SIZE_MAP = {
  xl: { wrap: "w-16 h-16", icon: "w-8 h-8" },
  lg: { wrap: "w-12 h-12", icon: "w-6 h-6" },
  md: { wrap: "w-10 h-10", icon: "w-5 h-5" },
  sm: { wrap: "w-8 h-8", icon: "w-4 h-4" },
} as const;

function NSectionHeaderRoot({
  children,
  image,
  showImage = true,
  imageSize = "xl",
  icon: Icon,
  iconColor = "text-blue-400",
  className,
  background = "bg-card",
  layout = "horizontal",
}: NSectionHeaderProps) {
  const isHorizontal = layout === "horizontal";
  const sizes = ICON_SIZE_MAP[imageSize];

  return (
    <div
      className={cn(
        background,
        "flex flex-col p-5 rounded-lg border shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "flex gap-4",
          isHorizontal ? "flex-row items-center" : "flex-col items-center text-center"
        )}
      >
        {showImage && (image || Icon) && (
          <div className="shrink-0">
            {image ? (
              <NAvatar src={image} size={imageSize} />
            ) : Icon ? (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full",
                  sizes.wrap,
                  background === "bg-card" ? "bg-muted" : "bg-card"
                )}
              >
                <Icon className={cn(sizes.icon, iconColor)} />
              </div>
            ) : null}
          </div>
        )}

        <div className={cn("flex-1 min-w-0", !isHorizontal && "w-full")}>
          {children}
        </div>
      </div>
    </div>
  );
}

function NSectionHeaderTitle({ children, className }: NSectionHeaderTitleProps) {
  return (
    <Label className={cn("text-2xl font-bold text-foreground block", className)}>
      {children}
    </Label>
  );
}

function NSectionHeaderSubtitle({ children, className }: NSectionHeaderSubtitleProps) {
  return (
    <Label className={cn("text-muted-foreground block", className)}>
      {children}
    </Label>
  );
}

function NSectionHeaderContent({ children, className }: NSectionHeaderContentProps) {
  return <div className={cn("mt-3", className)}>{children}</div>;
}

function NSectionHeaderActions({ children, className }: NSectionHeaderActionsProps) {
  return (
    <div className={cn("flex items-center gap-2 mt-2", className)}>{children}</div>
  );
}

export const NSectionHeader = Object.assign(NSectionHeaderRoot, {
  Title: NSectionHeaderTitle,
  Subtitle: NSectionHeaderSubtitle,
  Content: NSectionHeaderContent,
  Actions: NSectionHeaderActions,
});
