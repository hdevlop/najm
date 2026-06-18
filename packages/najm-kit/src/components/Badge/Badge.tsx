import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { NIcon, type NIconSource } from "../Icon";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
import { resolveVariantAlias } from "../../theme/design-config";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-secondary/60 bg-secondary/40 text-secondary-foreground [a&]:hover:bg-secondary/60",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/20 dark:text-red-300 dark:bg-destructive/15",
        success: "border-green-500/30 bg-green-500/10 text-green-700 [a&]:hover:bg-green-500/15 dark:text-green-300 dark:bg-green-500/10",
        warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 [a&]:hover:bg-yellow-500/15 dark:text-yellow-300 dark:bg-yellow-500/10",
        outline: "border-border/50 text-foreground [a&]:hover:bg-accent/50 [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const badgeColorVariants = cva(
  "inline-flex items-center justify-center rounded-md border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      color: {
        primary: "",
        secondary: "",
        accent: "",
        neutral: "",
        info: "",
        success: "",
        warning: "",
        destructive: "",
      },
      look: {
        solid: "border-transparent",
        soft: "",
        outline: "bg-transparent",
        dash: "bg-transparent border-dashed",
      },
      size: {
        sm: "px-1.5 py-0 text-[10px]",
        md: "px-2 py-0.5 text-xs",
        lg: "px-2.5 py-1 text-sm",
      },
      shape: {
        default: "",
        pill: "rounded-full",
        square: "rounded-none",
      },
    },
    compoundVariants: [
      { color: "primary", look: "solid", class: "bg-pink-500 text-white" },
      { color: "primary", look: "soft", class: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
      { color: "primary", look: ["outline", "dash"], class: "text-pink-400 border-pink-500/60" },
      { color: "secondary", look: "solid", class: "bg-indigo-500 text-white" },
      { color: "secondary", look: "soft", class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
      { color: "secondary", look: ["outline", "dash"], class: "text-indigo-400 border-indigo-500/60" },
      { color: "accent", look: "solid", class: "bg-orange-500 text-white" },
      { color: "accent", look: "soft", class: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
      { color: "accent", look: ["outline", "dash"], class: "text-orange-400 border-orange-500/60" },
      { color: "neutral", look: "solid", class: "bg-slate-500 text-white" },
      { color: "neutral", look: "soft", class: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
      { color: "neutral", look: ["outline", "dash"], class: "text-slate-400 border-slate-500/60" },
      { color: "info", look: "solid", class: "bg-sky-500 text-white" },
      { color: "info", look: "soft", class: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
      { color: "info", look: ["outline", "dash"], class: "text-sky-400 border-sky-500/60" },
      { color: "success", look: "solid", class: "bg-emerald-500 text-white" },
      { color: "success", look: "soft", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      { color: "success", look: ["outline", "dash"], class: "text-emerald-400 border-emerald-500/60" },
      { color: "warning", look: "solid", class: "bg-amber-400 text-slate-900" },
      { color: "warning", look: "soft", class: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
      { color: "warning", look: ["outline", "dash"], class: "text-amber-400 border-amber-400/60" },
      { color: "destructive", look: "solid", class: "bg-red-500 text-white" },
      { color: "destructive", look: "soft", class: "bg-red-500/10 text-red-400 border-red-500/20" },
      { color: "destructive", look: ["outline", "dash"], class: "text-red-400 border-red-500/60" },
    ],
    defaultVariants: { color: "primary", look: "solid", size: "md", shape: "default" },
  }
);

type BadgeVariantProps = VariantProps<typeof badgeVariants>;
type BadgeColorVariantProps = VariantProps<typeof badgeColorVariants>;

export type BadgeColor = NonNullable<BadgeColorVariantProps["color"]>;
export type BadgeLook = NonNullable<BadgeColorVariantProps["look"]>;
export type BadgeDisplayLook = BadgeLook | "minimal" | "text";
export type BadgeSize = NonNullable<BadgeColorVariantProps["size"]>;
export type BadgeShape = NonNullable<BadgeColorVariantProps["shape"]>;
export type BadgeVariant = NonNullable<BadgeVariantProps["variant"]>;
export type BadgeIcon = NIconSource;

export type BadgeProps = React.ComponentProps<"span"> & {
  asChild?: boolean;
  variant?: BadgeVariantProps["variant"];
  status?: string;
  statusMap?: Record<string, BadgeColor>;
  label?: string;
  showIcon?: boolean;
  color?: BadgeColor;
  look?: BadgeDisplayLook;
  size?: BadgeSize;
  shape?: BadgeShape;
  icon?: BadgeIcon;
  iconMap?: Record<string, BadgeIcon>;
  iconPosition?: "left" | "right";
};

const COLOR_TEXT_MAP: Record<string, string> = {
  success: "text-emerald-600",
  warning: "text-amber-500",
  accent: "text-orange-500",
  info: "text-sky-600",
  neutral: "text-slate-500",
  destructive: "text-red-600",
};

const SIZE_TEXT_MAP: Record<string, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

function renderIcon(icon: BadgeIcon | undefined) {
  if (!icon) return null;
  return <NIcon aria-hidden="true" icon={icon} className="shrink-0" />;
}

function Badge({
  className,
  variant,
  status,
  statusMap,
  label,
  showIcon,
  color,
  look,
  size,
  shape,
  icon,
  iconMap,
  iconPosition = "left",
  asChild = false,
  children,
  style,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  const recipe = useNajmComponentStyle("badge");
  // Variant aliasing: e.g. primary badge can reuse the secondary recipe.
  const aliased = resolveVariantAlias(
    recipe?.variants,
    (variant ?? recipe?.defaultVariant ?? "default") as string,
  );
  const effVariant = (variant ?? (aliased.variant as BadgeVariant) ?? recipe?.defaultVariant) as BadgeProps["variant"];
  const recipeRadius = shape === undefined ? resolveRadiusValue(recipe?.radius) : undefined;
  const recipeStyle = recipeRadius ? { borderRadius: recipeRadius, ...style } : style;
  const resolvedColor = statusMap?.[status ?? ""] ?? color;
  const resolvedLabel =
    label ??
    (typeof children === "string" ? children : undefined) ??
    status;
  const content = typeof children !== "string" && children ? children : resolvedLabel ?? children;
  const resolvedIcon = icon ?? (resolvedColor ? iconMap?.[resolvedColor] : undefined);
  const iconNode = renderIcon(showIcon ? resolvedIcon : icon);
  const isMinimal = look === "minimal" || look === "text";

  if (isMinimal) {
    const textColor = COLOR_TEXT_MAP[resolvedColor ?? ""] ?? "text-foreground";
    const sizeClass = SIZE_TEXT_MAP[size ?? "md"] ?? "text-sm";

    return (
      <Comp
        data-slot="badge"
        className={cn(
          "inline-flex items-center gap-1.5 font-medium bg-transparent border-0",
          look === "text" ? "px-0" : undefined,
          textColor,
          sizeClass,
          className
        )}
        style={recipeStyle}
        {...props}
      >
        {iconPosition === "left" && iconNode}
        {content}
        {iconPosition === "right" && iconNode}
      </Comp>
    );
  }

  const classes = resolvedColor
    ? badgeColorVariants({ color: resolvedColor, look: look as BadgeLook | undefined, size, shape })
    : badgeVariants({ variant: effVariant });

  return (
    <Comp data-slot="badge" className={cn(classes, aliased.style?.className, className)} style={recipeStyle} {...props}>
      {iconPosition === "left" && iconNode}
      {content}
      {iconPosition === "right" && iconNode}
    </Comp>
  );
}

const NBadge = Badge;

export type NBadgeLook = BadgeDisplayLook;
export type NBadgeProps = BadgeProps;

export { Badge, NBadge, badgeVariants, badgeColorVariants };
