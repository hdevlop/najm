import { plugin } from '../server';
import { ParamService } from './ParamService';
import { PARAM_CONFIG } from './tokens';
import type { ParamPluginConfig } from './types';

export const params = (config: ParamPluginConfig = true) =>
   plugin('params')
      .services(ParamService)
      .config(PARAM_CONFIG, config)
      .build();
