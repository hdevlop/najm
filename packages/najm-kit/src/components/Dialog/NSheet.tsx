import React, { createContext, useContext, type ReactNode, type CSSProperties } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { NajmScroll } from "../ui/scroll";
import { cn } from "../../lib/cn";

const PortalScopeContext = createContext<string | undefined>(undefined);

export function NPortalScopeProvider({ className, children }: { className?: string; children: ReactNode }) {
  return <PortalScopeContext.Provider value={className}>{children}</PortalScopeContext.Provider>;
}

export const useNPortalScope = () => useContext(PortalScopeContext);

export interface NSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Sheet width in pixels. Default 480. */
  width?: number;
  side?: "left" | "right" | "top" | "bottom";
  /** Override portal scope class (otherwise inherits from NPortalScopeProvider). */
  portalClassName?: string;
  /** Override the body container className (default: standard padding + scroll). */
  bodyClassName?: string;
  /** Override the SheetContent className (e.g. for bg / border tweaks). */
  contentClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Standardized studio sheet primitive.
 * - Inline `style` width (bypasses Tailwind responsive-prefix-scoping issues in consumer apps).
 * - Inherits portal scope from `NPortalScopeProvider` so prefixed CSS (e.g. `.rs-studio`) reaches portaled content.
 * - One header + scrollable body + optional sticky footer.
 */
export function NSheet({
  open,
  onOpenChange,
  title,
  description,
  width = 480,
  side = "right",
  portalClassName,
  bodyClassName,
  contentClassName,
  children,
  footer,
}: NSheetProps) {
  const inheritedScope = useNPortalScope();
  const portal = portalClassName ?? inheritedScope;
  const style: CSSProperties = {
    width: `min(${width}px, 95vw)`,
    maxWidth: `${width}px`,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        portalClassName={portal}
        className={cn(
          "flex h-dvh max-h-dvh flex-col overflow-hidden bg-sidebar p-0 text-foreground",
          contentClassName,
        )}
        style={style}
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4 gap-1">
          <SheetTitle className="text-sm font-semibold text-foreground">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-xs text-muted-foreground">{description}</SheetDescription>
          )}
        </SheetHeader>
        <NajmScroll axis="y" className="min-h-0 flex-1">
          <div className={cn("px-6 py-5", bodyClassName)}>
            {children}
          </div>
        </NajmScroll>
        {footer && (
          <div className="shrink-0 border-t border-border px-6 py-3">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
