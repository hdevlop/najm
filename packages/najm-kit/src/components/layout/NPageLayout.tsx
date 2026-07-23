import * as React from "react";
import { useNajmDesign } from "../../theme/design-provider";
import { cn } from "../../lib/cn";

export interface NPageLayoutProps extends React.HTMLAttributes<HTMLElement> {
  as?: "main" | "div" | "section";
}

export function NPageLayout({
  as: Comp = "main",
  className,
  style,
  ...props
}: NPageLayoutProps) {
  const { layout } = useNajmDesign();
  const pageGutter = layout?.pageGutter ?? "var(--page-gutter, 24px)";
  const sectionGap = layout?.sectionGap ?? "var(--section-gap, 20px)";

  return (
    <Comp
      className={cn("flex min-w-0 flex-col", className)}
      style={{
        gap: sectionGap,
        paddingInline: pageGutter,
        paddingBlock: sectionGap,
        ...style,
      }}
      {...props}
    />
  );
}
