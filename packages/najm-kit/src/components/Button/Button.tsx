import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { LoaderCircleIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { inputBorderClasses } from "../../theme/borders";
import { NIcon, type NIconSource } from "../Icon";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
import { resolveVariantAlias } from "../../theme/design-config";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none transition-all",
    "disabled:pointer-events-none disabled:opacity-50 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-transparent text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        tertiary: "bg-tertiary text-tertiary-foreground shadow-xs hover:bg-tertiary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "h-auto p-0 text-primary underline-offset-4 hover:underline",
        success: "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700",
        warning: "bg-amber-400 text-slate-950 shadow-xs hover:bg-amber-500",
        info: "bg-sky-600 text-white shadow-xs hover:bg-sky-700",
        soft: "bg-primary/10 text-primary shadow-none hover:bg-primary/15",
        subtle: "bg-muted text-foreground shadow-none hover:bg-muted/80",
        plain: "bg-transparent shadow-none hover:bg-transparent",
      },
      size: {
        "2xs": "h-5 gap-1 px-1.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        md: "h-9 px-4 py-2 has-[>svg]:px-3",
        lg: "h-10 px-6 has-[>svg]:px-4",
        xl: "h-12 px-8 text-base [&_svg:not([class*='size-'])]:size-5",
        "2xl": "h-14 px-10 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10 [&_svg:not([class*='size-'])]:size-5",
        "icon-xl": "size-12 [&_svg:not([class*='size-'])]:size-5",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-sm",
        default: "rounded-md",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
        "2xl": "rounded-2xl",
        full: "rounded-full",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "default",
      fullWidth: false,
    },
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;
type AsyncClickHandler = (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;

export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;
export type ButtonRounded = NonNullable<ButtonVariantProps["rounded"]>;
export type ButtonLoaderPosition = "left" | "right" | "center";
export type ButtonIcon = NIconSource;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">,
    ButtonVariantProps {
  asChild?: boolean;
  loading?: boolean;
  autoLoading?: boolean;
  disabledWhileLoading?: boolean;
  loadingText?: React.ReactNode;
  loader?: React.ReactNode;
  loaderPosition?: ButtonLoaderPosition;
  leftIcon?: ButtonIcon;
  rightIcon?: ButtonIcon;
  bordered?: boolean;
  onClick?: AsyncClickHandler;
}

export type NButtonProps = ButtonProps;

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof (value as Promise<unknown>).then === "function");
}

const defaultLoader = <LoaderCircleIcon aria-hidden="true" className="animate-spin" />;

function renderIcon(icon: ButtonIcon | undefined) {
  if (!icon) return null;
  return <NIcon aria-hidden="true" icon={icon} className="shrink-0" />;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      fullWidth,
      asChild = false,
      loading = false,
      autoLoading = true,
      disabledWhileLoading = true,
      loadingText,
      loader = defaultLoader,
      loaderPosition = "left",
      leftIcon,
      rightIcon,
      bordered,
      disabled,
      children,
      onClick,
      style,
      ...props
    },
    ref
  ) => {
    const recipe = useNajmComponentStyle("button");
    // Explicit props win over design-config defaults.
    const aliased = resolveVariantAlias(
      recipe?.variants,
      (variant ?? recipe?.defaultVariant ?? "default") as string,
    );
    const effVariant = (variant ?? (aliased.variant as ButtonVariant) ?? recipe?.defaultVariant) as ButtonProps["variant"];
    const effSize = (size ?? recipe?.defaultSize) as ButtonProps["size"];
    const recipeRadius = rounded === undefined ? resolveRadiusValue(recipe?.radius) : undefined;
    const recipeStyle = recipeRadius ? { borderRadius: recipeRadius } : undefined;

    const [pending, setPending] = React.useState(false);
    const isLoading = loading || pending;
    const isDisabled = disabled || (disabledWhileLoading && isLoading);
    const Comp = asChild ? Slot : "button";

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }

        const result = onClick?.(event);
        if (autoLoading && isPromiseLike(result)) {
          setPending(true);
          void result.then(
            () => setPending(false),
            () => setPending(false)
          );
        }
      },
      [autoLoading, isDisabled, onClick]
    );

    const child = asChild ? React.Children.only(children) : null;
    const childContent =
      asChild && React.isValidElement<{ children?: React.ReactNode }>(child)
        ? child.props.children
        : children;
    const content = loadingText && isLoading ? loadingText : childContent;
    const loaderNode = isLoading ? loader : null;
    const leftIconNode = renderIcon(leftIcon);
    const rightIconNode = renderIcon(rightIcon);
    const showCenteredLoader = Boolean(loaderNode && loaderPosition === "center");
    const renderedContent = showCenteredLoader ? (
      <>
        <span className="invisible inline-flex items-center gap-2">
          {leftIconNode}
          {content}
          {rightIconNode}
        </span>
        <span className="absolute inset-0 inline-flex items-center justify-center">
          {loaderNode}
        </span>
      </>
    ) : (
      <>
        {loaderNode && loaderPosition === "left" ? loaderNode : leftIconNode}
        {content}
        {loaderNode && loaderPosition === "right" ? loaderNode : rightIconNode}
      </>
    );
    const renderedChild =
      asChild && React.isValidElement<{ children?: React.ReactNode }>(child)
        ? React.cloneElement(child, undefined, renderedContent)
        : renderedContent;

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-loading={isLoading || undefined}
        data-disabled={isDisabled || undefined}
        data-bordered={effVariant === "outline" ? "true" : bordered === false ? "false" : bordered ? "true" : undefined}
        aria-busy={isLoading || undefined}
        aria-disabled={asChild && isDisabled ? true : undefined}
        disabled={!asChild ? isDisabled : undefined}
        style={recipeStyle ? { ...recipeStyle, ...style } : style}
        className={cn(
          buttonVariants({ variant: effVariant, size: effSize, rounded, fullWidth }),
          aliased.style?.className,
          // Outline buttons always carry an input-style border.
          effVariant === "outline" && inputBorderClasses(true),
          // Filled/ghost/plain/link/success/warning/info/soft/subtle buttons only get a
          // border when the consumer explicitly opts in via `bordered`. Global theming
          // should not outline every filled button.
          effVariant !== "outline" && bordered === true && cn(
            "border",
            "border-muted-foreground"
          ),
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {renderedChild}
      </Comp>
    );
  }
);
Button.displayName = "Button";

const NButton = Button;

export { Button, NButton, buttonVariants };
