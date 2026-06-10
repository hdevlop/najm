import React from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "../../lib/cn";

export type NIconSource =
  | React.ReactElement
  | React.ComponentType<any>
  | React.ExoticComponent<any>
  | string
  | {
      src: string;
      alt?: string;
    };

export type NIconProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  size?: string | number;
  icon: NIconSource;
  alt?: string;
  color?: string;
  className?: string;
  strokeWidth?: number;
  stroke?: string;
  fill?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  style?: React.CSSProperties;
};

function toPascalCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function isImageSource(value: string) {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(value)
  );
}

function isComponentSource(value: unknown): value is React.ComponentType<any> | React.ExoticComponent<any> {
  return typeof value === "function" || Boolean(value && typeof value === "object" && "$$typeof" in value);
}

const NIcon: React.FC<NIconProps> = ({
  icon = "circle",
  size = 24,
  alt = "",
  className,
  style,
  onClick,
  ...rest
}) => {
  const dimensionStyle = {
    width: size,
    height: size,
    ...style,
  };

  if (React.isValidElement(icon)) {
    return React.cloneElement(icon, {
      className: cn(className, (icon.props as { className?: string }).className),
      onClick,
      ...rest,
    } as Record<string, unknown>);
  }

  if (icon && typeof icon === "object" && "src" in icon) {
    return (
      <img
        alt={icon.alt ?? alt}
        className={cn("inline-block shrink-0 object-contain", className)}
        src={icon.src}
        style={dimensionStyle}
        onClick={onClick as React.MouseEventHandler<HTMLImageElement>}
        {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  }

  if (isComponentSource(icon)) {
    const IconComponent = icon as React.ComponentType<any>;
    return <IconComponent size={size} className={className} onClick={onClick} style={style} {...rest} />;
  }

  if (typeof icon === "string") {
    if (isImageSource(icon)) {
      return (
        <img
          alt={alt}
          className={cn("inline-block shrink-0 object-contain", className)}
          src={icon}
          style={dimensionStyle}
          onClick={onClick as React.MouseEventHandler<HTMLImageElement>}
          {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
        />
      );
    }

    const pascalCaseIcon = toPascalCase(icon);

    if (LucideIcons[pascalCaseIcon as keyof typeof LucideIcons]) {
      const LucideIcon = LucideIcons[pascalCaseIcon as keyof typeof LucideIcons] as React.ComponentType<any>;
      return <LucideIcon size={size} className={className} onClick={onClick} style={style} {...rest} />;
    }

    return null;
  }

  return null;
};

NIcon.displayName = "NIcon";

export { NIcon };
