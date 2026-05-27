import { createAlsToken } from 'najm-core';
import type { ContributionToken } from 'najm-core';
import type { Translations } from './types';

export const I18N_META = Symbol.for('najm:i18n');
export const I18N_CONFIG = Symbol.for('najm:i18n:config');
export const LANG_META = createAlsToken<string>('lang');

/**
 * Well-known symbol for I18nService instance
 * Used by other packages (like router) to get translator
 */
export const I18N_SERVICE = Symbol.for('I18nService');

/**
 * Registry token for plugin translation contributions
 * Plugins push their default translations here
 * Merge priority: plugin defaults < user translations (user wins)
 */
export const I18N_TRANSLATIONS = Symbol.for('najm:i18n:translations');

/**
 * Typed contribution token for i18n translations
 */
export const I18N_CONTRIBUTIONS: ContributionToken<Translations> =
  Symbol.for('najm:I18N_CONTRIBUTIONS') as ContributionToken<Translations>;
