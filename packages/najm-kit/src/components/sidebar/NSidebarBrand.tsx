import { cn } from "../../lib/cn";
import { NImage } from "../ui/NImage";
import type { NSidebarBrandProps } from "./types";

// Fixed across apps on purpose — override with `classNames.sidebarLogo`.
// The collapsed box is 32px so it centres itself in the 64px rail's px-4 header
// rather than needing a margin offset to compensate for overflow.
const COLLAPSED_BOX = "size-8 shrink-0 overflow-hidden rounded-lg";
const EXPANDED_MARK_BOX = "h-10 w-32";
const EXPANDED_CHIP_BOX = "size-10 shrink-0 rounded-lg";
const CHIP_SKIN = "bg-sidebar-primary/10";
const FIT = "[&_img]:size-full [&_img]:object-contain";

export function NSidebarBrand({ logo, collapsed, linkComponent: Link, className }: NSidebarBrandProps) {
  const source = collapsed ? logo.collapsed ?? logo.expanded : logo.expanded;
  const showText = !collapsed && (logo.title || logo.subtitle);
  const isChip = logo.variant === "chip";
  if (!source && !showText) return null;

  const image =
    typeof source === "string" ? (
      <NImage src={source} fallback={logo.fallback} alt={logo.alt ?? ""} aria-hidden={logo.alt ? undefined : true} />
    ) : (
      source
    );

  const inner = (
    <>
      {image ? (
        <span
          className={cn(
            "flex items-center justify-center",
            collapsed ? COLLAPSED_BOX : isChip ? EXPANDED_CHIP_BOX : EXPANDED_MARK_BOX,
            isChip && CHIP_SKIN,
            FIT,
            className,
          )}
        >
          {image}
        </span>
      ) : null}
      {showText ? (
        <span className="flex min-w-0 flex-col">
          {logo.title ? <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{logo.title}</span> : null}
          {logo.subtitle ? <span className="truncate text-xs leading-tight text-sidebar-foreground/60">{logo.subtitle}</span> : null}
        </span>
      ) : null}
    </>
  );

  // A lone mark centres in the header; a chip or any text stays left-aligned.
  const wrapper = cn(
    "flex min-w-0 items-center gap-2.5 text-left",
    !collapsed && !showText && !isChip && "mx-auto",
  );
  const interactive = "cursor-pointer transition-opacity hover:opacity-80";

  if (logo.href && Link) return <Link href={logo.href} className={cn(wrapper, interactive)}>{inner}</Link>;
  if (logo.href) return <a href={logo.href} className={cn(wrapper, interactive)}>{inner}</a>;
  if (logo.onClick) return <button type="button" onClick={logo.onClick} className={cn(wrapper, interactive)}>{inner}</button>;
  return <div className={wrapper}>{inner}</div>;
}
