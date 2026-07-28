import * as React from "react";
import { OverlayScrollbars, type PartialOptions } from "overlayscrollbars";
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentProps } from "overlayscrollbars-react";
import { cn } from "../../lib/cn";

export interface NajmScrollViewportOptions {
  axis?: "both" | "x" | "y";
  autoHide?: "never" | "scroll" | "leave" | "move";
  options?: PartialOptions;
}

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

function najmScrollOptions(
  axis: "both" | "x" | "y",
  autoHide: "never" | "scroll" | "leave" | "move",
  options?: PartialOptions,
): PartialOptions {
  return {
    scrollbars: { theme: "os-theme-najm", autoHide, autoHideDelay: 500, clickScroll: true },
    overflow: {
      x: axis === "x" || axis === "both" ? "scroll" : "hidden",
      y: axis === "y" || axis === "both" ? "scroll" : "hidden",
    },
    ...options,
  };
}

/**
 * Applies Najm's overlay scrollbar to an existing host + viewport pair.
 * Use this for headless primitives (Radix/cmdk) that must keep ownership of
 * their actual scrolling viewport for keyboard navigation and positioning.
 */
export function useNajmScrollViewport<T extends HTMLElement = HTMLDivElement>({
  axis = "y",
  autoHide = "never",
  options,
}: NajmScrollViewportOptions = {}) {
  const hostRef = React.useRef<T>(null);
  const viewportRef = React.useRef<T>(null);

  React.useEffect(() => {
    const target = hostRef.current;
    const viewport = viewportRef.current;
    if (!target || !viewport) return;

    const instance = OverlayScrollbars(
      { target, elements: { viewport } },
      najmScrollOptions(axis, autoHide, options),
    );
    const containWheel = (event: WheelEvent) => event.stopPropagation();
    viewport.addEventListener("wheel", containWheel, { passive: true });

    return () => {
      viewport.removeEventListener("wheel", containWheel);
      instance.destroy();
    };
  }, [axis, autoHide, options]);

  return { hostRef, viewportRef };
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
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
      }}
      element={element as "div" | undefined}
      defer
      options={najmScrollOptions(axis, autoHide, options || undefined)}
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
