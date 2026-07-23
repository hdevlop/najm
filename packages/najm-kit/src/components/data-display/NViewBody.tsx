import React, { type ReactNode } from 'react';
import { cn } from "../../lib/cn";

interface NViewBodyProps {
  children: ReactNode;
  className?: string;
  variant?: 'table' | 'empty' | 'stack';
}

const variantClasses = {
  table: 'px-4 pb-4 pt-0 sm:px-5 sm:pb-5',
  empty: 'px-4 py-5 sm:px-5',
  stack: 'px-4 py-4 space-y-4 sm:px-5',
};

export function NViewBody({ children, className, variant = 'table' }: NViewBodyProps) {
  return (
    <div className={cn(variantClasses[variant], className)}>
      {children}
    </div>
  );
}