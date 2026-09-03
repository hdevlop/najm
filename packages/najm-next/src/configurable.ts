import { createNajmNextConfig } from './internal/createConfig';
import type { NajmNextConfigOverrides, NextConfig } from './internal/types';

export function defineNajmNextConfig(overrides: NajmNextConfigOverrides = {}): NextConfig {
  return createNajmNextConfig(overrides);
}

export type { NajmNextConfigOverrides, NextConfig };
