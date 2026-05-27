import { plugin } from 'najm-core';
import { CorsService } from './CorsService';
import type { CorsPluginConfig } from './types';
import { CORS_CONFIG } from './tokens';

export const cors = (config: CorsPluginConfig = true) =>
   plugin('cors')
      .services(CorsService)
      .config(CORS_CONFIG, config)
      .build();
