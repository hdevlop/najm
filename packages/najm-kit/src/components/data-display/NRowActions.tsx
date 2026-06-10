import React, { type ReactNode } from 'react';

interface NRowActionsProps {
  children: ReactNode;
}

export function NRowActions({ children }: NRowActionsProps) {
  return <div className="flex items-center gap-1">{children}</div>;
}