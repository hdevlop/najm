import type { ReactNode, ComponentType } from 'react';

export type SelectItemType = {
  value: string;
  label: string;
  icon?: string | ComponentType<{ className?: string }>;
};

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full';
export type DialogWidth = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'auto';
export type DialogHeight = 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full';

export type RenderSlot<T = any> = T | ((ctx: T) => ReactNode);
