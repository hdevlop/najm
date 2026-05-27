import * as React from 'react';
import { cn } from "../../lib/cn";

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      <div
        className="h-full w-full overflow-y-auto overflow-x-hidden"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#3a3a4e transparent',
        }}
      >
        {children}
      </div>
    </div>
  );
}