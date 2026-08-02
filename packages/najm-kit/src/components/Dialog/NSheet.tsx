import React, { createContext, useContext, type ComponentType, type ReactNode, type CSSProperties } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { NajmScroll } from "../ui/scroll";
import { cn } from "../../lib/cn";

const PortalScopeContext = createContext<string | undefined>(undefined);

export function NPortalScopeProvider({ className, children }: { className?: string; children: ReactNode }) {
  return <PortalScopeContext.Provider value={className}>{children}</PortalScopeContext.Provider>;
}

export const useNPortalScope = () => useContext(PortalScopeContext);

export interface NSheetClassNames {
  content?: string;
  header?: string;
  body?: string;
  footer?: string;
}

export interface NSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** Sheet width in pixels. Default 480. */
  width?: number;
  side?: "left" | "right" | "top" | "bottom";
  /** Override portal scope class (otherwise inherits from NPortalScopeProvider). */
  portalClassName?: string;
  /** Slot-level class overrides for the sheet surface and its three sections. */
  classNames?: NSheetClassNames;
  /** @deprecated Use `classNames.body` instead. */
  bodyClassName?: string;
  /** @deprecated Use `classNames.content` instead. */
  contentClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const responsiveSectionPadding = "px-3 py-3 lg:px-3 2xl:px-4";

/**
 * Standardized studio sheet primitive.
 * - Inline `style` width (bypasses Tailwind responsive-prefix-scoping issues in consumer apps).
 * - Inherits portal scope from `NPortalScopeProvider` so prefixed CSS (e.g. `.rs-studio`) reaches portaled content.
 * - One header + scrollable body + optional sticky footer.
 */
export function NSheet({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  width = 480,
  side = "right",
  portalClassName,
  classNames,
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
          "flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden bg-background p-0 text-foreground",
          contentClassName,
          classNames?.content,
        )}
        style={style}
      >
        <SheetHeader
          className={cn(
            "shrink-0 border-b border-border p-0",
            responsiveSectionPadding,
            classNames?.header,
          )}
        >
          <div className="flex min-w-0 items-center gap-2 lg:gap-3 xl:gap-3 2xl:gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-sm font-semibold text-foreground">{title}</SheetTitle>
              {description && (
                <SheetDescription className="truncate text-xs text-muted-foreground">
                  {description}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>
        <NajmScroll axis="y" className="min-h-0 flex-1">
          <div
            data-slot="sheet-body"
            className={cn(responsiveSectionPadding, bodyClassName, classNames?.body)}
          >
            {children}
          </div>
        </NajmScroll>
        {footer && (
          <div
            data-slot="sheet-footer"
            className={cn(
              "shrink-0 border-t border-border",
              responsiveSectionPadding,
              classNames?.footer,
            )}
          >
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
