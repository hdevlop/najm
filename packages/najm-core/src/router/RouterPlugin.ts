import { plugin } from '../server';
import { RouterService } from './RouterService';
import { ROUTER_CONFIG } from './tokens';
import type { RouterPluginConfig } from './types';

export const router = (config: RouterPluginConfig = {}) =>
   plugin('router')
      .services(RouterService)
      .config(ROUTER_CONFIG, config)
      .build();
