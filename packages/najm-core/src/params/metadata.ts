import { MetaHelper } from 'diject';
import { PARAMS } from './tokens';
import type { ParameterMetadata } from './types';

export const getParameterMetadata = (target: any): ParameterMetadata[] =>
   MetaHelper.get<ParameterMetadata[]>(PARAMS, target) ?? [];
