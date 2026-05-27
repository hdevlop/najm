import React from "react";
import { cn } from "../../lib/cn";

export interface NTableCardRootProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "onContextMenu"> {
  card: {
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  };
  children: React.ReactNode;
  className?: string;
}

export function NTableCardRoot({ card, children, className, ...rest }: NTableCardRootProps) {
  return (
    <div
      data-row=""
      onClick={card.onClick}
      onContextMenu={card.onContextMenu}
      className={cn(className)}
      {...rest}
    >
      {children}
    </div>
  );
}
