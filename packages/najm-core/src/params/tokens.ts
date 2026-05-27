import { createAlsToken } from 'diject';
import type { Context } from 'hono';
import type { HRequest } from './types';

// Core ALS tokens that param plugin manages
export const CONTEXT = createAlsToken<Context>('context');
export const REQUEST = createAlsToken<HRequest>('request');
export const PARSER = createAlsToken<any>('parser');

// Plugin config token
export const PARAM_CONFIG = Symbol.for('najm:PARAM_CONFIG');
export const PARAMS = Symbol.for('najm:params')