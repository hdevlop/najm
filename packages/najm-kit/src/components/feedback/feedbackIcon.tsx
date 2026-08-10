import * as React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Normalizes a consumer-supplied icon to a renderable element.
 *
 * `NEmptyState`, `NErrorState`, `NForbiddenState`, and `NNotFoundState` all
 * accept either a Lucide component or any React element. The Lucide path
 * needs sizing; the React-element path must keep whatever `className`,
 * `aria-label`, and handlers the consumer attached — so we never clone an
 * element we did not build.
 *
 * `size` is one of a small fixed set: dynamic Tailwind classes disappear in
 * consumer builds unless explicitly safelisted, so the helper does not
 * accept arbitrary sizes. Use the size that matches the surface: `sm` for
 * `inline`, `lg` for `panel`, `xl` for `page`.
 */
export type NFeedbackIconSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<NFeedbackIconSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

export function renderFeedbackIcon(
  icon: React.ReactNode | LucideIcon | undefined,
  options?: { size?: NFeedbackIconSize; decorative?: boolean },
): React.ReactElement | null {
  if (!icon) return null;

  const size = options?.size ?? "md";
  const sizeClass = SIZE_CLASSES[size];

  if (typeof icon === "function" || (typeof icon === "object" && "render" in icon)) {
    const Component = icon as React.ElementType;
    return (
      <Component
        className={sizeClass}
        aria-hidden={options?.decorative ? true : undefined}
      />
    );
  }

  if (React.isValidElement(icon)) {
    if (!options?.decorative) return icon as React.ReactElement;
    // The element came from the consumer — clone only the `aria-hidden` flag
    // so the rest of its props (className, aria-label, handlers) reach the
    // child untouched. The cast is needed because `ReactElement`'s props type
    // is generic and cannot be widened here.
    return React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, {
      "aria-hidden": true,
    });
  }

  return null;
}
