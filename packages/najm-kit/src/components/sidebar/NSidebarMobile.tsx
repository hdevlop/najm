import { cn } from "../../lib/cn";
import { borderColorClassForDegree, useResolvedBorderDegree } from "../../theme/borders";
import { Menu, X } from "lucide-react";
import type { NSidebarMobileProps } from "./types";

export function NSidebarMobile({
  open,
  onOpen,
  onClose,
  mobileBreakpoint = 'md',
  width = 240,
  hamburgerLabel = "Open sidebar",
  closeLabel = "Close sidebar",
  hamburgerClassName,
  showHamburgerButton = true,
  children,
  bordered,
  borderDegree,
}: NSidebarMobileProps) {
  const mobileClass = mobileBreakpoint === 'sm' ? 'sm:hidden'
    : mobileBreakpoint === 'lg' ? 'lg:hidden'
    : 'md:hidden';

  const resolvedBorderDegree = useResolvedBorderDegree({
    borderDegree,
    bordered,
    fallback: "default",
  });
  const isStrong = resolvedBorderDegree === "strong";
  const isNone = resolvedBorderDegree === "none";
  const mobileBorderClass = isNone
    ? "border-transparent"
    : borderColorClassForDegree(resolvedBorderDegree);

  return (
    <>
      {showHamburgerButton && (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "fixed top-3 left-3 z-50 p-2 rounded-lg bg-card border shadow-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            mobileClass,
            hamburgerClassName,
            open && "hidden"
          )}
          aria-label={hamburgerLabel}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div
          className={cn("fixed inset-0 z-40 bg-black/50", mobileClass)}
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        data-border-degree={resolvedBorderDegree}
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card flex flex-col transition-transform duration-200",
          // When global strong is on, we want a strong border, not a soft `border-r` edge.
          isStrong
            ? `border ${mobileBorderClass} shadow-none`
            : isNone
              ? "border-transparent"
              : `border-r ${mobileBorderClass}`,
          mobileClass,
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ width }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1 rounded-md hover:bg-accent text-muted-foreground"
          aria-label={closeLabel}
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </aside>
    </>
  );
}
