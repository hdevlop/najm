// ============================================================================
// GuardPlugin.ts - Guard plugin registration (Fluent API)
// ============================================================================

import { plugin } from 'najm-core';
import { GuardService } from './GuardService';
import { GUARD_CONFIG } from './tokens';
import type { GuardPluginConfig } from './types';

export const guards = (config: GuardPluginConfig = true) =>
   plugin('guards')
      .services(GuardService)
      .config(GUARD_CONFIG, config)
      .build();

export const GuardPlugin = guards;
