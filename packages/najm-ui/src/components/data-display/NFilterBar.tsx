import React, { type ReactNode } from 'react';

interface NFilterBarProps {
  children: ReactNode;
  className?: string;
}

export function NFilterBar({ children, className }: NFilterBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {children}
    </div>
  );
}