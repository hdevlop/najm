import { plugin } from 'najm-core';
import { I18nService } from './I18nService';
import type { I18nPluginConfig } from './types';
import { I18N_CONFIG } from './tokens';

export const i18n = (config: I18nPluginConfig = true) =>
   plugin('i18n')
      .services(I18nService)
      .config(I18N_CONFIG, config)
      .build();
