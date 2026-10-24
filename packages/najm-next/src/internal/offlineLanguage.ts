/**
 * Where an app records the language it displays, for the worker's stacked
 * offline document. Shared by the worker source and the browser client, so
 * the two never disagree on the database, its schema or the accepted values.
 */
export const OFFLINE_LANGUAGE_DATABASE_PREFIX = 'najm-pwa-offline-language:';
export const OFFLINE_LANGUAGE_STORE = 'values';
export const OFFLINE_LANGUAGE_KEY = 'language';

export const CACHE_TOKEN = /^[a-z0-9][a-z0-9._-]*$/i;
export const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
