import * as React from "react";

export type NajmDirection = "ltr" | "rtl";

/**
 * The document's writing direction, kept in sync with the `dir` attribute.
 *
 * Radix reads direction from its own `DirectionProvider` and defaults to
 * `"ltr"`. It never consults the DOM, and it stamps that default onto every
 * portaled `Content` element — so in an application that sets
 * `<html dir="rtl">`, a dropdown or select popup renders LTR inside an
 * otherwise RTL page, and the logical padding and inset utilities on its items
 * resolve against the wrong side. Nothing bridged the two until this hook and
 * the `DirectionProvider` above it.
 *
 * Reading the attribute rather than a language preference is deliberate: `dir`
 * is what the browser itself lays out against, applications already set it, and
 * a kit that inferred direction from a locale list would disagree with the page
 * the moment an application supported a language the kit had not heard of.
 *
 * Server renders return `"ltr"` and the first client effect corrects it. That
 * is not a hydration risk for the popups, which mount only on open.
 */
export function useDocumentDirection(override?: NajmDirection): NajmDirection {
  const [direction, setDirection] = React.useState<NajmDirection>(
    override ?? "ltr",
  );

  React.useEffect(() => {
    if (override) {
      setDirection(override);
      return;
    }

    const root = document.documentElement;
    const read = () =>
      setDirection(root.getAttribute("dir") === "rtl" ? "rtl" : "ltr");

    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["dir"] });
    return () => observer.disconnect();
  }, [override]);

  return direction;
}
