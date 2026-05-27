// t.ts
import type { I18nService } from './I18nService';

let _service: I18nService;

export function registerI18n(service: I18nService) {
   _service = service;
}

export function t(key: string, params?: Record<string, any>): string {
   return _service.t(key, params);
}