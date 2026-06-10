import * as React from "react";
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentProps } from "overlayscrollbars-react";
import { cn } from "../../lib/cn";

export interface NajmScrollProps extends Omit<OverlayScrollbarsComponentProps, "options" | "ref" | "element"> {
  /** Host element tag. Defaults to "div". */
  element?: keyof React.JSX.IntrinsicElements;
  /** Which axes may scroll. Defaults to vertical only. */
  axis?: "both" | "x" | "y";
  /** Scrollbar auto-hide behaviour. Defaults to "never" (always visible while scrollable). */
  autoHide?: "never" | "scroll" | "leave" | "move";
  /** Receives the actual scroll viewport element (the node that scrolls), for measuring or scrollTo. */
  viewportRef?: React.Ref<HTMLElement>;
  options?: OverlayScrollbarsComponentProps["options"];
}

function assignRef(ref: React.Ref<HTMLElement> | undefined, node: HTMLElement | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(node);
  else (ref as React.MutableRefObject<HTMLElement | null>).current = node;
}

function applyViewportLayout(node: HTMLElement, axis: "both" | "x" | "y") {
  node.style.width = "100%";
  node.style.height = "100%";
  node.style.minWidth = "0";
  node.style.minHeight = "0";
  node.style.overflowX = axis === "x" || axis === "both" ? "auto" : "hidden";
  node.style.overflowY = axis === "y" || axis === "both" ? "auto" : "hidden";
}

/**
 * Scroll container with a custom overlay scrollbar (OverlayScrollbars).
 *
 * The bar floats over the content and reserves **no layout space** in every
 * browser — unlike native scrollbars, which `overflow: auto` always reserves a
 * gutter for. Children are rendered inside the scroll viewport, so put layout
 * (grid/flex) classes on a child element, and sizing (`flex-1 min-h-0`,
 * `max-h-*`, etc.) on this component.
 */
export function NajmScroll({ className, axis = "y", autoHide = "never", viewportRef, events, options, element, children, style, ...props }: NajmScrollProps) {
  return (
    <OverlayScrollbarsComponent
      className={cn(className)}
      style={{
        ...(style as React.CSSProperties | undefined),
        display: "flex",
        alignItems: "stretch",
        flexDirection: "row",
        flexWrap: "nowrap",
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
      }}
      element={element as "div" | undefined}
      defer
      options={{
        scrollbars: { theme: "os-theme-najm", autoHide, autoHideDelay: 500, clickScroll: true },
        overflow: {
          x: axis === "x" || axis === "both" ? "scroll" : "hidden",
          y: axis === "y" || axis === "both" ? "scroll" : "hidden",
        },
        ...options,
      }}
      events={{
        ...events,
        initialized: (instance, ...rest) => {
          const viewport = instance.elements().viewport as HTMLElement;
          applyViewportLayout(viewport, axis);
          assignRef(viewportRef, viewport);
          (events as any)?.initialized?.(instance, ...rest);
        },
        updated: (instance, ...rest) => {
          applyViewportLayout(instance.elements().viewport as HTMLElement, axis);
          (events as any)?.updated?.(instance, ...rest);
        },
        destroyed: (instance, ...rest) => {
          assignRef(viewportRef, null);
          (events as any)?.destroyed?.(instance, ...rest);
        },
      }}
      {...props}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
