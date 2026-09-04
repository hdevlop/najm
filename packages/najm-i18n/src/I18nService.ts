
import { languageDetector } from 'hono/language';
import { setCookie } from 'hono/cookie';
import { Service, Meta, Inject, DI, Container, getPropertyInjections } from 'najm-core';
import { LoggerService, Scan, ScannerService, ScanType, INJECTION_TYPES, Err } from 'najm-core';
import { I18N_CONFIG, I18N_CONTRIBUTIONS, I18N_SERVICE, LANG_META } from './tokens';
import type { I18nPluginConfig, I18nOptions, Translations } from './types';
import { CONTEXT } from 'najm-core';
import { registerI18n } from './t';
import { translate } from './translator';

// Dangerous keys for prototype pollution protection
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

@Service()
@Meta({ layer: 'plugin', order: 1 })
export class I18nService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(I18N_CONFIG) private config!: I18nPluginConfig;
   @Inject(LoggerService) private log!: LoggerService;

   private translations: Translations = {};
   private defaultLanguage: string = 'en';
   private fallbackToDefaultLanguage = false;
   private availableLanguages: string[] = ['en'];
   private lookupCookie: string = 'language';
   private standaloneLanguage: string = 'en';
   private parsedConfig!: I18nOptions;
   private configParsed = false;
   private translationsMerged = false;
   private injectorRegistered = false;
   private middlewarePushed = false;
   private helperRegistered = false;

   private static readonly DEFAULT_CONFIG: I18nOptions = {
      translations: {},
      defaultLanguage: 'en',
      supportedLanguages: ['en'],
      order: ['cookie', 'querystring', 'header'],
      lookupQueryString: 'lang',
      lookupCookie: 'language',
      lookupFromHeaderKey: 'language',
      lookupFromPathIndex: 0,
      caches: ['cookie'],
      ignoreCase: true,
      debug: false,
      fallbackToDefaultLanguage: false,
   };

   async onInit(): Promise<void> {
      this.registerHelper();
      this.parseGlobalConfig();
      this.mergeContributedTranslations();
      this.registerInjector();
      this.registerSelf();
   }

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      this.scanner.scan(ScanType.APP, {
         onClass: (provider) => {
            const injections = getPropertyInjections(provider);
            const i18nInjections = injections.filter(inj => inj.token === 'I18n');

            for (const injection of i18nInjections) {
               this.validateInjection(injection, provider);

               this.container.setInjection({
                  type: INJECTION_TYPES.I18N,
                  target: provider,
                  propertyKey: injection.propertyKey,
                  options: injection.options,
               });
            }
         }
      });
   }

   private validateInjection(injection: any, provider: any): void {
      if (injection.options?.prefix && injection.options?.resolveKey) {
         Err.invalidConfig(
            `i18n.${provider.name}.${String(injection.propertyKey)}`,
            'cannot use both prefix and resolveKey'
         );
      }

      if (injection.options?.resolveKey && typeof injection.options.resolveKey !== 'string') {
         throw Err.invalidConfig(
            `i18n.${provider.name}.${String(injection.propertyKey)}`,
            'resolveKey must be a string'
         );
      }
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.registerHelper();
      this.parseGlobalConfig();
      this.mergeContributedTranslations();
      this.registerInjector();
      this.pushMiddleware();
      this.registerSelf();
   }

   private registerHelper(): void {
      if (this.helperRegistered) {
         return;
      }

      registerI18n(this);
      this.helperRegistered = true;
   }

   private parseGlobalConfig(): void {
      if (this.configParsed) {
         return;
      }

      const i18nOption = this.config;

      if (!i18nOption) {
         this.parsedConfig = { ...I18nService.DEFAULT_CONFIG };
      } else if (i18nOption === true || Object.keys(i18nOption).length === 0) {
         this.parsedConfig = { ...I18nService.DEFAULT_CONFIG };
      } else {
         this.parsedConfig = {
            ...I18nService.DEFAULT_CONFIG,
            ...i18nOption,
         };
      }

      this.defaultLanguage = this.parsedConfig.defaultLanguage ?? 'en';
      this.availableLanguages = this.parsedConfig.supportedLanguages ?? ['en'];
      this.lookupCookie = this.parsedConfig.lookupCookie ?? 'language';
      this.fallbackToDefaultLanguage =
         this.parsedConfig.fallbackToDefaultLanguage ?? false;
      this.standaloneLanguage = this.defaultLanguage;

      this.validateGlobalConfig();
      this.configParsed = true;
   }

   /**
    * Merge translations with priority:
    * 1. Plugin contributions (base layer)
    * 2. User config (wins)
    */
   private mergeContributedTranslations(): void {
      if (this.translationsMerged) {
         return;
      }

      // Get contributions if they exist
      let contributions: Translations[] | undefined;
      if (this.container.has(I18N_CONTRIBUTIONS)) {
         contributions = this.container.get(I18N_CONTRIBUTIONS) as Translations[] | undefined;
      }

      // Layer 1: Plugin contributions (base)
      if (contributions?.length) {
         for (const contributed of contributions) {
            if (!this.isValidTranslations(contributed)) {
               this.log.warn('Invalid i18n contribution format, skipping');
               continue;
            }
            this.translations = this.deepMerge(this.translations, contributed);
         }
      }

      // Layer 2: User config (wins)
      if (this.parsedConfig.translations) {
         this.translations = this.deepMerge(this.translations, this.parsedConfig.translations);
      }

      this.translationsMerged = true;
   }

   /**
    * Validate translations object
    */
   private isValidTranslations(obj: unknown): obj is Translations {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
         return false;
      }
      for (const [lang, translations] of Object.entries(obj)) {
         if (typeof lang !== 'string') return false;
         if (typeof translations !== 'object' || translations === null || Array.isArray(translations)) {
            return false;
         }
      }
      return true;
   }

   /**
    * Deep merge with prototype pollution protection
    */
   private deepMerge(target: Translations, source: Translations): Translations {
      const result: Translations = {};

      // Copy target
      for (const [lang, values] of Object.entries(target)) {
         if (DANGEROUS_KEYS.has(lang)) continue;
         result[lang] = this.deepClone(values as Record<string, unknown>);
      }

      // Merge source
      for (const [lang, values] of Object.entries(source)) {
         if (DANGEROUS_KEYS.has(lang)) continue;
         if (result[lang]) {
            result[lang] = this.mergeObjects(result[lang], values as Record<string, unknown>);
         } else {
            result[lang] = this.deepClone(values as Record<string, unknown>);
         }
      }

      return result;
   }

   private mergeObjects(
      target: Record<string, unknown>,
      source: Record<string, unknown>
   ): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(target)) {
         if (DANGEROUS_KEYS.has(key)) continue;
         result[key] = this.isPlainObject(value) ? this.deepClone(value) : value;
      }

      for (const [key, value] of Object.entries(source)) {
         if (DANGEROUS_KEYS.has(key)) continue;
         if (this.isPlainObject(value) && this.isPlainObject(result[key])) {
            result[key] = this.mergeObjects(
               result[key] as Record<string, unknown>,
               value as Record<string, unknown>
            );
         } else {
            result[key] = this.isPlainObject(value) ? this.deepClone(value) : value;
         }
      }

      return result;
   }

   private deepClone(obj: Record<string, unknown>): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
         if (DANGEROUS_KEYS.has(key)) continue;
         if (this.isPlainObject(value)) {
            result[key] = this.deepClone(value as Record<string, unknown>);
         } else if (Array.isArray(value)) {
            result[key] = [...value];
         } else {
            result[key] = value;
         }
      }
      return result;
   }

   private isPlainObject(val: unknown): val is Record<string, unknown> {
      return typeof val === 'object' && val !== null && !Array.isArray(val);
   }

   private validateGlobalConfig(): void {
      if (this.availableLanguages.length === 0) {
         Err.invalidConfig('i18n.supportedLanguages', 'Must have at least one supported language');
      }

      if (!this.availableLanguages.includes(this.defaultLanguage)) {
         Err.invalidConfig(
            'i18n.defaultLanguage',
            `Default language '${this.defaultLanguage}' must be in supportedLanguages`
         );
      }
   }

   private registerInjector(): void {
      if (this.injectorRegistered) {
         return;
      }

      this.container.use({
         name: 'I18n',
         global: true,
         inject: (instance, _ctor, _registry, injections) => {
            const i18nInjections = injections?.filter((inj: any) => inj.token === 'I18n') ?? [];

            for (const { propertyKey, options } of i18nInjections) {
               if (options?.resolveKey) {
                  if (propertyKey in instance) {
                     delete instance[propertyKey];
                  }

                  Object.defineProperty(instance, propertyKey, {
                     get: () => this.t(options.resolveKey),
                     enumerable: true,
                     configurable: true,
                  });
               } else if (options?.prefix) {
                  instance[propertyKey] = (key: string, params?: Record<string, any>) =>
                     this.t(`${options.prefix}.${key}`, params);
               } else {
                  instance[propertyKey] = this.t.bind(this);
               }
            }
         },
      });

      this.injectorRegistered = true;
   }

   private pushMiddleware(): void {
      if (this.middlewarePushed) {
         return;
      }

      this.container.setInjection({
         type: INJECTION_TYPES.MIDDLEWARE,
         scope: 'global',
         name: 'i18n-language-detector',
         order: 15,
         handler: this.createLanguageMiddleware(),
      });

      this.container.setInjection({
         type: INJECTION_TYPES.MIDDLEWARE,
         scope: 'global',
         name: 'i18n-store-language',
         order: 16,
         handler: async (c: any, next: any) => {
            const detectedLanguage = c.get('language');
            if (detectedLanguage) {
               this.container.set(LANG_META, detectedLanguage);
            }
            return await next();
         },
      });

      this.middlewarePushed = true;
   }

   private registerSelf(): void {
      this.container.set(I18N_SERVICE, this);
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE & READY
   // ============================================================================

   async activate(): Promise<void> { }

   async onReady(): Promise<void> {
      const count = this.container.getInjections(INJECTION_TYPES.I18N).length;
      this.log.debug(`I18n plugin ready: ${count} injection(s)`);
      this.log.debug(`Languages: ${this.availableLanguages.join(', ')} (default: ${this.defaultLanguage})`);
   }

   // ============================================================================
   // TRANSLATION API
   // ============================================================================

   public t(key: string, params?: Record<string, any>): string {
      const language = this.container.get(LANG_META) || this.standaloneLanguage;
      return this.translate(key, language, params);
   }

   private translate(key: string, language: string, params?: Record<string, any>): string {
      return translate(this.translations, language, key, params, {
         defaultLanguage: this.defaultLanguage,
         fallbackToDefaultLanguage: this.fallbackToDefaultLanguage,
      });
   }

   // ============================================================================
   // LANGUAGE MANAGEMENT
   // ============================================================================

   public getCurrentLanguage(): string {
      return this.container.get(LANG_META) || this.standaloneLanguage;
   }

   public setLanguage(language: string): boolean {
      if (!this.availableLanguages.includes(language)) return false;

      if (this.container.isActive()) {
         this.container.set(LANG_META, language);

         const ctx = this.container.get(CONTEXT);
         if (ctx) {
            const cookieOpts = this.parsedConfig.cookieOptions || {};
            setCookie(ctx, this.lookupCookie, language, {
               path: '/',
               sameSite: 'Lax',
               secure: process.env.NODE_ENV === 'production',
               maxAge: 365 * 24 * 60 * 60,
               httpOnly: true,
               ...cookieOpts,
            });
         }
      } else {
         this.standaloneLanguage = language;
      }

      return true;
   }

   public getAvailableLanguages(): string[] {
      return this.availableLanguages;
   }

   public isLanguageSupported(language: string): boolean {
      return this.availableLanguages.includes(language);
   }

   public getDefaultLanguage(): string {
      return this.defaultLanguage;
   }

   // ============================================================================
   // MIDDLEWARE FACTORY
   // ============================================================================

   private createLanguageMiddleware() {
      const supportedLanguages = [...this.availableLanguages];
      const fallbackLanguage = this.defaultLanguage;

      if (!supportedLanguages.includes(fallbackLanguage)) {
         supportedLanguages.push(fallbackLanguage);
      }

      const cookieOptions = {
         path: '/',
         sameSite: 'Lax' as const,
         secure: process.env.NODE_ENV === 'production',
         maxAge: 365 * 24 * 60 * 60,
         httpOnly: true,
         ...this.parsedConfig.cookieOptions,
      };

      return languageDetector({
         supportedLanguages,
         fallbackLanguage,
         order: this.parsedConfig.order ?? ['cookie', 'querystring', 'header'],
         lookupQueryString: this.parsedConfig.lookupQueryString ?? 'lang',
         lookupCookie: this.lookupCookie,
         lookupFromHeaderKey: this.parsedConfig.lookupFromHeaderKey ?? 'language',
         lookupFromPathIndex: this.parsedConfig.lookupFromPathIndex ?? 0,
         caches: this.parsedConfig.caches ?? ['cookie'],
         ignoreCase: this.parsedConfig.ignoreCase ?? true,
         convertDetectedLanguage: this.parsedConfig.convertDetectedLanguage,
         debug: this.parsedConfig.debug ?? false,
         cookieOptions,
      });
   }

   // ============================================================================
   // PUBLIC API
   // ============================================================================

   public getConfig(): I18nOptions {
      return this.parsedConfig;
   }

   public getTranslations(): Translations {
      return this.translations;
   }
}
