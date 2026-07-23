import { Context } from 'hono';
import {
   getCookie as honoGetCookie,
   setCookie as honoSetCookie,
   deleteCookie as honoDeleteCookie
} from 'hono/cookie';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Service, Meta, Inject, DI, Container, getPropertyInjections } from 'najm-core';
import { Err, LoggerService, Scan, ScannerService, ScanType } from 'najm-core';
import { COOKIES_CONFIG } from './tokens';
import type { CookiePluginConfig, CookieServiceConfig, CookieOptions, CookiesDecoratorOptions } from './types';
import { CONTEXT } from 'najm-core';

@Service()
@Meta({ layer: 'plugin' })
export class CookieService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(COOKIES_CONFIG) private config!: CookiePluginConfig;
   @Inject(LoggerService) private log!: LoggerService;

   private defaultOptions!: CookieOptions;
   private prefix!: string;

   private static readonly DEFAULT_CONFIG: CookieServiceConfig = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
   };

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      this.scanner.scan(ScanType.CONTROLLER, {
         onClass: (controller) => {
            const propInjections = getPropertyInjections(controller);
            const cookieInjections = propInjections.filter(inj => inj.token === 'Cookies');

            for (const injection of cookieInjections) {
               this.validateInjection(injection, controller);
               this.container.setInjection({
                  type: 'cookies',
                  target: controller,
                  propertyKey: injection.propertyKey,
                  options: injection.options,
               });
            }
         }
      });
   }

   private validateInjection(injection: any, controller: any): void {
      if (injection.options?.signed && !injection.options?.secret) {
         this.log.warn(
            `@Cookies() on ${controller.name}.${injection.propertyKey}: signed=true requires a secret`
         );
      }
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.parseConfig();
      this.registerInjector();
   }

   private parseConfig(): void {
      const cookieOption = this.config;

      if (!cookieOption) {
         this.defaultOptions = {
            ...CookieService.DEFAULT_CONFIG,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            path: '/',
         };
         this.prefix = '';
         return;
      }

      if (cookieOption === true || Object.keys(cookieOption).length === 0) {
         this.defaultOptions = {
            ...CookieService.DEFAULT_CONFIG,
         };
         this.prefix = CookieService.DEFAULT_CONFIG.prefix ?? '';
      } else {
         this.defaultOptions = {
            httpOnly: cookieOption.httpOnly ?? CookieService.DEFAULT_CONFIG.httpOnly,
            secure: cookieOption.secure ?? CookieService.DEFAULT_CONFIG.secure,
            sameSite: cookieOption.sameSite ?? CookieService.DEFAULT_CONFIG.sameSite,
            path: cookieOption.path ?? CookieService.DEFAULT_CONFIG.path,
            domain: cookieOption.domain,
            maxAge: cookieOption.maxAge,
            expires: cookieOption.expires,
         };
         this.prefix = cookieOption.prefix ?? '';
      }
   }

   private registerInjector(): void {
      this.container.set('Cookies', this);

      this.container.use({
         name: 'Cookies',
         global: true,
         inject: (instance, _ctor, _registry, injections) => {
            const cookieInjections = injections?.filter(inj => inj.token === 'Cookies') ?? [];

            for (const { propertyKey, options } of cookieInjections) {
               if (options?.prefix) {
                  instance[propertyKey] = this.createScopedAccessor(options);
               } else {
                  instance[propertyKey] = this;
               }
            }
         },
      });
   }

   private createScopedAccessor(options: CookiesDecoratorOptions) {
      const service = this;
      const scopedPrefix = options.prefix ?? '';

      return {
         get: (name: string) => service.get(scopedPrefix + name),
         set: (name: string, value: string, opts?: Partial<CookieOptions>) =>
            service.set(scopedPrefix + name, value, { ...options, ...opts }),
         delete: (name: string, opts?: Partial<CookieOptions>) =>
            service.delete(scopedPrefix + name, { ...options, ...opts }),
         has: (name: string) => service.has(scopedPrefix + name),
         getJSON: <T = any>(name: string) => service.getJSON<T>(scopedPrefix + name),
         setJSON: (name: string, value: any, opts?: Partial<CookieOptions>) =>
            service.setJSON(scopedPrefix + name, value, { ...options, ...opts }),
         getSigned: (name: string, secret?: string) =>
            service.getSigned(scopedPrefix + name, secret ?? options.secret ?? ''),
         setSigned: (name: string, value: string, secret?: string, opts?: Partial<CookieOptions>) =>
            service.setSigned(scopedPrefix + name, value, secret ?? options.secret ?? '', { ...options, ...opts }),
      };
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE & READY
   // ============================================================================

   async activate(): Promise<void> {}

   async onReady(): Promise<void> {
      const injections = this.container.getInjections('cookies');
      this.log.debug(`Cookie plugin ready: ${injections.length} injection(s)`);
      if (this.prefix) {
         this.log.debug(`Using cookie prefix: ${this.prefix}`);
      }
   }

   // ============================================================================
   // CORE COOKIE METHODS
   // ============================================================================

   public get(name: string): string | undefined {
      const ctx = this.getContext();
      const cookieName = this.buildCookieName(name);
      return honoGetCookie(ctx, cookieName);
   }

   public set(name: string, value: string, options?: Partial<CookieOptions>): void {
      const ctx = this.getContext();
      const cookieName = this.buildCookieName(name);
      const mergedOptions = { ...this.defaultOptions, ...options } as any;
      honoSetCookie(ctx, cookieName, value, mergedOptions);
   }

   public delete(name: string, options?: Partial<CookieOptions>): void {
      const ctx = this.getContext();
      const cookieName = this.buildCookieName(name);
      const mergedOptions = { ...this.defaultOptions, ...options } as any;
      honoDeleteCookie(ctx, cookieName, mergedOptions);
   }

   // ============================================================================
   // CONVENIENCE METHODS
   // ============================================================================

   public getAll(): Record<string, string> {
      const ctx = this.getContext();
      const cookies: Record<string, string> = {};
      const cookieHeader = ctx.req.header('cookie');

      if (!cookieHeader) return cookies;

      for (const cookie of cookieHeader.split(';')) {
         try {
            const trimmed = cookie.trim();
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;

            const name = trimmed.substring(0, eqIndex);
            const value = trimmed.substring(eqIndex + 1);
            if (!name) continue;

            const actualName = this.prefix && name.startsWith(this.prefix)
               ? name.substring(this.prefix.length)
               : name;

            cookies[actualName] = decodeURIComponent(value);
         } catch {
            continue;
         }
      }

      return cookies;
   }

   public has(name: string): boolean {
      return this.get(name) !== undefined;
   }

   public setSecure(name: string, value: string, options?: Partial<CookieOptions>): void {
      this.set(name, value, {
         ...options,
         httpOnly: true,
         secure: true,
         sameSite: 'Strict',
      });
   }

   public setSession(name: string, value: string, options?: Partial<CookieOptions>): void {
      const { maxAge, expires, ...restOptions } = options || {};
      this.set(name, value, {
         ...restOptions,
         maxAge: undefined,
         expires: undefined
      });
   }

   public setPersistent(name: string, value: string, days: number = 30, options?: Partial<CookieOptions>): void {
      this.set(name, value, {
         ...options,
         maxAge: days * 24 * 60 * 60,
      });
   }

   // ============================================================================
   // SIGNED COOKIES
   // ============================================================================

   public setSigned(name: string, value: string, secret: string, options?: Partial<CookieOptions>): void {
      const signature = this.sign(value, secret);
      const signedValue = `${value}.${signature}`;
      this.set(name, signedValue, options);
   }

   public getSigned(name: string, secret: string): string | undefined {
      const signedValue = this.get(name);
      if (!signedValue) return undefined;

      const lastDotIndex = signedValue.lastIndexOf('.');
      if (lastDotIndex === -1) return undefined;

      const value = signedValue.substring(0, lastDotIndex);
      const signature = signedValue.substring(lastDotIndex + 1);

      const expected = this.sign(value, secret);
      if (expected.length !== signature.length) return undefined;
      try {
         if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
            return undefined;
         }
      } catch {
         return undefined;
      }

      return value;
   }

   // ============================================================================
   // JSON COOKIES
   // ============================================================================

   public getJSON<T = any>(name: string): T | undefined {
      const value = this.get(name);
      if (!value) return undefined;

      try {
         return JSON.parse(decodeURIComponent(value)) as T;
      } catch {
         return undefined;
      }
   }

   public setJSON(name: string, value: any, options?: Partial<CookieOptions>): void {
      const jsonString = JSON.stringify(value);
      this.set(name, encodeURIComponent(jsonString), options);
   }

   // ============================================================================
   // UTILITY METHODS
   // ============================================================================

   private getContext(): Context {
      const ctx = this.container.get(CONTEXT);
      if (!ctx) {
         Err.invalidOperation(
            'Context not available. Ensure the request context middleware is configured.'
         );
      }
      return ctx;
   }

   private buildCookieName(name: string): string {
      return this.prefix ? `${this.prefix}${name}` : name;
   }

   private sign(value: string, secret: string): string {
      return createHmac('sha256', secret).update(value).digest('base64url');
   }

   // ============================================================================
   // CONFIGURATION
   // ============================================================================

   public setDefaultOptions(options: Partial<CookieOptions>): void {
      this.defaultOptions = { ...this.defaultOptions, ...options };
   }

   public getDefaultOptions(): Readonly<CookieOptions> {
      return Object.freeze({ ...this.defaultOptions });
   }

   public setPrefix(prefix: string): void {
      this.prefix = prefix;
   }

   public getPrefix(): string {
      return this.prefix;
   }
}
