import * as React from "react";
import { cn } from "../../lib/cn";
import { useNajmKitLabels } from "../../lib/kitLabels";
import { sidebarBorderClasses } from "../../theme/borders";
import { Menu, X } from "lucide-react";
import type { NSidebarMobileProps } from "./types";

export function NSidebarMobile({
  open,
  onOpen,
  onClose,
  mobileBreakpoint = 'md',
  width = 240,
  hamburgerLabel: hamburgerLabelProp,
  closeLabel: closeLabelProp,
  hamburgerClassName,
  showHamburgerButton = true,
  children,
  bordered,
}: NSidebarMobileProps) {
  const labels = useNajmKitLabels();
  const hamburgerLabel = hamburgerLabelProp ?? labels.openSidebar;
  const closeLabel = closeLabelProp ?? labels.closeSidebar;
  // A closed drawer is only moved off-screen. Make it inert so its links leave
  // the tab order and the accessibility tree until it opens. Set as a DOM
  // property: React 18 and 19 disagree on how the `inert` attribute is passed.
  const drawerRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
  }, [open]);
  const mobileClass = mobileBreakpoint === 'sm' ? 'sm:hidden'
    : mobileBreakpoint === 'lg' ? 'lg:hidden'
    : 'md:hidden';

  return (
    <>
      {showHamburgerButton && (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "fixed top-3 start-3 z-50 p-2 rounded-lg bg-sidebar najm-border border-sidebar-border shadow-md text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors",
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
        ref={drawerRef}
        data-bordered={bordered === false ? "false" : bordered ? "true" : undefined}
        className={cn(
          "fixed inset-y-0 start-0 z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200",
          sidebarBorderClasses(bordered, 'end'),
          mobileClass,
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        )}
        style={{ width }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 end-3 z-10 p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70"
          aria-label={closeLabel}
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </aside>
    </>
  );
}
