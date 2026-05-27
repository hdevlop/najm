import React from "react";
import { Badge } from "../ui/badge";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { CheckCircle2, AlertCircle, Info, Circle, XCircle, Hourglass, type LucideIcon } from "lucide-react";

export type StatusTheme = "success" | "warning" | "processing" | "info" | "neutral" | "danger";

const STATUS_THEME_MAP: Record<string, StatusTheme> = {
  active: "success", approved: "success", completed: "success", published: "success",
  paid: "success", present: "success", planned: "info", pending: "processing",
  maintenance: "warning", late: "warning", draft: "warning", suspended: "warning",
  expired: "warning", processing: "processing", inactive: "neutral", retired: "neutral",
  archived: "neutral", cancelled: "danger", rejected: "danger", deleted: "danger",
  failed: "danger",
};

const THEME_ICON_MAP: Record<StatusTheme, LucideIcon> = {
  success: CheckCircle2, warning: AlertCircle, processing: Hourglass,
  info: Info, neutral: Circle, danger: XCircle,
};

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-all duration-200 hover:shadow-sm rounded-md px-2.5 py-1 text-sm",
  {
    variants: {
      variant: {
        badge: "", outline: "", canvas: "",
        minimal: "bg-transparent border-0 shadow-none hover:shadow-none",
        text: "bg-transparent border-0 shadow-none hover:shadow-none px-0",
      },
      theme: { success: "", warning: "", processing: "", info: "", neutral: "", danger: "" },
    },
    compoundVariants: [
      { variant: "badge", theme: "success", className: "bg-green-200 text-green-800 border-green-300" },
      { variant: "badge", theme: "warning", className: "bg-yellow-200 text-yellow-800 border-yellow-300" },
      { variant: "badge", theme: "processing", className: "bg-orange-200 text-orange-800 border-orange-300" },
      { variant: "badge", theme: "info", className: "bg-blue-200 text-blue-800 border-blue-300" },
      { variant: "badge", theme: "neutral", className: "bg-gray-200 text-gray-800 border-gray-300" },
      { variant: "badge", theme: "danger", className: "bg-red-200 text-red-800 border-red-300" },
      { variant: "outline", theme: "success", className: "border-2 border-green-600 text-green-700 bg-green-50" },
      { variant: "outline", theme: "warning", className: "border-2 border-yellow-600 text-yellow-700 bg-yellow-50" },
      { variant: "outline", theme: "processing", className: "border-2 border-orange-600 text-orange-700 bg-orange-50" },
      { variant: "outline", theme: "info", className: "border-2 border-blue-600 text-blue-700 bg-blue-50" },
      { variant: "outline", theme: "neutral", className: "border-2 border-gray-600 text-gray-700 bg-gray-50" },
      { variant: "outline", theme: "danger", className: "border-2 border-red-600 text-red-700 bg-red-50" },
      { variant: "canvas", theme: "success", className: "bg-green-50 text-green-700 border border-green-200" },
      { variant: "canvas", theme: "warning", className: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
      { variant: "canvas", theme: "processing", className: "bg-orange-50 text-orange-700 border border-orange-200" },
      { variant: "canvas", theme: "info", className: "bg-blue-50 text-blue-700 border border-blue-200" },
      { variant: "canvas", theme: "neutral", className: "bg-gray-50 text-gray-700 border border-gray-200" },
      { variant: "canvas", theme: "danger", className: "bg-red-50 text-red-700 border border-red-200" },
      { variant: ["minimal", "text"], theme: "success", className: "text-green-600" },
      { variant: ["minimal", "text"], theme: "warning", className: "text-yellow-600" },
      { variant: ["minimal", "text"], theme: "processing", className: "text-orange-600" },
      { variant: ["minimal", "text"], theme: "info", className: "text-blue-600" },
      { variant: ["minimal", "text"], theme: "neutral", className: "text-gray-600" },
      { variant: ["minimal", "text"], theme: "danger", className: "text-red-600" },
    ],
    defaultVariants: { variant: "badge", theme: "neutral" },
  }
);

export interface NStatusBadgeProps {
  status?: string;
  theme?: StatusTheme;
  showIcon?: boolean;
  icon?: LucideIcon;
  className?: string;
  variant?: "badge" | "outline" | "canvas" | "minimal" | "text";
  children?: React.ReactNode;
}

export function NStatusBadge({ status, theme: propTheme, variant = "badge", showIcon = false, icon: CustomIcon, className, children }: NStatusBadgeProps) {
  const theme = propTheme || (status ? STATUS_THEME_MAP[status] : "neutral") || "neutral";
  const Icon = CustomIcon || THEME_ICON_MAP[theme];
  const label = children || status || "";

  const content = (
    <>
      {showIcon && Icon && <Icon size={16} />}
      {label}
    </>
  );

  if (variant === "text" || variant === "minimal") {
    return <div className={cn(statusBadgeVariants({ variant, theme }), className)}>{content}</div>;
  }

  return (
    <Badge className={cn(statusBadgeVariants({ variant, theme }), className)}>{content}</Badge>
  );
}

export { STATUS_THEME_MAP, THEME_ICON_MAP, statusBadgeVariants };
export function getStatusTheme(status: string): StatusTheme {
  return STATUS_THEME_MAP[status] || "neutral";
}
