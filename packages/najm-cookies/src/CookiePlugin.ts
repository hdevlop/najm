import { plugin } from 'najm-core';
import { CookieService } from './CookieService';
import { COOKIES_CONFIG } from './tokens';
import type { CookiePluginConfig } from './types';

export const cookies = (config: CookiePluginConfig = {}) =>
  plugin('cookies')
    .services(CookieService)
    .config(COOKIES_CONFIG, config)
    .build();
