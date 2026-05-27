import { type ReactNode } from 'react';

export function resolveSlot<T>(slot: T | ((ctx: any) => ReactNode), ctx?: any): ReactNode {
  if (typeof slot === 'function') {
    return (slot as (ctx: any) => ReactNode)(ctx);
  }
  return slot as ReactNode;
}
