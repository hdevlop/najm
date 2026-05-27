import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { i18n, I18n, I18nOptions, I18nService, type TFn, t } from "../src";
import { Server } from "najm-core";
import { Controller, reset, Service } from "najm-core";
import { Params, Query, Body, Get, Post, RawResponse } from "najm-core";

// ==========================================
// TRANSLATION FIXTURES (Global)
// ==========================================

const enTranslations = {
   greeting: "Hello",
   farewell: "Goodbye",
   welcome: "Welcome, {{name}}!",
   items: {
      count: "You have {{count}} items",
      empty: "No items found",
   },
   errors: {
      notFound: "Resource not found",
      unauthorized: "You are not authorized",
      validation: {
         required: "{{field}} is required",
         minLength: "{{field}} must be at least {{min}} characters",
      },
   },
   buttons: {
      submit: "Submit",
      cancel: "Cancel",
      save: "Save Changes",
   },
   pages: {
      home: {
         title: "Home Page",
         description: "Welcome to our application",
      },
      about: {
         title: "About Us",
         description: "Learn more about our company",
      },
   },
};

const frTranslations = {
   greeting: "Bonjour",
   farewell: "Au revoir",
   welcome: "Bienvenue, {{name}}!",
   items: {
      count: "Vous avez {{count}} articles",
      empty: "Aucun article trouvé",
   },
   errors: {
      notFound: "Ressource non trouvée",
      unauthorized: "Vous n'êtes pas autorisé",
      validation: {
         required: "{{field}} est requis",
         minLength: "{{field}} doit contenir au moins {{min}} caractères",
      },
   },
   buttons: {
      submit: "Soumettre",
      cancel: "Annuler",
      save: "Enregistrer",
   },
   pages: {
      home: {
         title: "Page d'accueil",
         description: "Bienvenue dans notre application",
      },
      about: {
         title: "À propos de nous",
         description: "En savoir plus sur notre entreprise",
      },
   },
};

const arTranslations = {
   greeting: "مرحبا",
   farewell: "وداعا",
   welcome: "أهلاً {{name}}!",
   items: {
      count: "لديك {{count}} عناصر",
      empty: "لا توجد عناصر",
   },
   errors: {
      notFound: "المورد غير موجود",
      unauthorized: "غير مصرح لك",
   },
};

const checkoutTranslations = {
   en: {
      checkout: {
         title: "Checkout",
         cart: {
            empty: "Your cart is empty",
            items: "{{count}} items in cart",
            total: "Total: ${{amount}}",
         },
         form: {
            email: "Email Address",
            emailRequired: "Email is required",
            shipping: "Shipping Address",
            payment: "Payment Method",
         },
         buttons: {
            continue: "Continue Shopping",
            checkout: "Proceed to Checkout",
            pay: "Pay Now",
         },
      },
   },
   fr: {
      checkout: {
         title: "Paiement",
         cart: {
            empty: "Votre panier est vide",
            items: "{{count}} articles dans le panier",
            total: "Total: {{amount}}€",
         },
         form: {
            email: "Adresse e-mail",
            emailRequired: "L'e-mail est requis",
            shipping: "Adresse de livraison",
            payment: "Mode de paiement",
         },
         buttons: {
            continue: "Continuer vos achats",
            checkout: "Passer à la caisse",
            pay: "Payer maintenant",
         },
      },
   },
};

const apiTranslations = {
   en: {
      api: {
         errors: {
            400: "Bad Request",
            401: "Unauthorized - Please login",
            403: "Forbidden - Access denied",
            404: "Not Found",
            500: "Internal Server Error",
         },
         validation: {
            required: "{{field}} is required",
            invalid: "{{field}} is invalid",
            tooShort: "{{field}} must be at least {{min}} characters",
            tooLong: "{{field}} must be at most {{max}} characters",
         },
      },
   },
   ar: {
      api: {
         errors: {
            400: "طلب غير صالح",
            401: "غير مصرح - يرجى تسجيل الدخول",
            403: "ممنوع - تم رفض الوصول",
            404: "غير موجود",
            500: "خطأ في الخادم الداخلي",
         },
         validation: {
            required: "{{field}} مطلوب",
            invalid: "{{field}} غير صالح",
            tooShort: "{{field}} يجب أن يكون {{min}} أحرف على الأقل",
            tooLong: "{{field}} يجب ألا يتجاوز {{max}} حرف",
         },
      },
   },
};

const defaultI18nConfig: I18nOptions = {
   translations: {
      en: enTranslations,
      fr: frTranslations,
      ar: arTranslations,
   },
   defaultLanguage: "en",
   supportedLanguages: ["en", "fr", "ar"],
   order: ["querystring", "cookie", "header"],
   lookupQueryString: "lang",
   lookupCookie: "language",
};

// ==========================================
// CONTROLLERS & SERVICES
// ==========================================

@Controller("/i18n")
class BasicI18nController {
   constructor(private i18n: I18nService) { }

   @Get("/greeting")
   getGreeting() {
      return {
         message: this.i18n.t("greeting"),
         language: this.i18n.getCurrentLanguage(),
      };
   }

   @Get("/farewell")
   getFarewell() {
      return { message: this.i18n.t("farewell") };
   }

   @Get("/missing")
   getMissing() {
      return { message: this.i18n.t("this.key.does.not.exist") };
   }
}

@Controller("/i18n")
class NestedKeysController {
   constructor(private i18n: I18nService) { }

   @Get("/errors/not-found")
   getNotFound() {
      return { message: this.i18n.t("errors.notFound") };
   }

   @Get("/pages/home/title")
   getHomeTitle() {
      return { message: this.i18n.t("pages.home.title") };
   }

   @Get("/errors/validation/required")
   getValidationRequired() {
      return { message: this.i18n.t("errors.validation.required", { field: "Email" }) };
   }
}

@Controller("/i18n")
class InterpolationController {
   constructor(private i18n: I18nService) { }

   @Get("/welcome/:name")
   getWelcome(@Params("name") name: string) {
      return { message: this.i18n.t("welcome", { name }) };
   }

   @Get("/validation")
   getValidation(@Query("field") field: string, @Query("min") min: string) {
      return { message: this.i18n.t("errors.validation.minLength", { field, min }) };
   }

   @Get("/items/:count")
   getItems(@Params("count") count: string) {
      return { message: this.i18n.t("items.count", { count }) };
   }
}

@Controller("/i18n")
class LanguageManagementController {
   constructor(private i18n: I18nService) { }

   @Get("/set/:lang")
   setLanguage(@Params("lang") lang: string) {
      const success = this.i18n.setLanguage(lang);
      return {
         success,
         language: this.i18n.getCurrentLanguage(),
         greeting: this.i18n.t("greeting"),
      };
   }

   @Get("/languages")
   getLanguages() {
      return { languages: this.i18n.getAvailableLanguages() };
   }

   @Get("/supported/:lang")
   isSupported(@Params("lang") lang: string) {
      return { supported: this.i18n.isLanguageSupported(lang) };
   }

   @Get("/default")
   getDefault() {
      return { defaultLanguage: this.i18n.getDefaultLanguage() };
   }

   @Get("/current")
   getCurrent() {
      return {
         language: this.i18n.getCurrentLanguage(),
         greeting: this.i18n.t("greeting"),
      };
   }
}

@Controller("/i18n")
class DecoratorBasicController {
   @I18n() t!: TFn;

   @Get("/greeting")
   getGreeting() {
      // Using direct t() function instead of this.t
      return { message: t("greeting") };
   }

   @Get("/welcome/:name")
   getWelcome(@Params("name") name: string) {
      // Using direct t() function with interpolation
      return { message: t("welcome", { name }) };
   }
}

@Controller("/errors")
class PrefixErrorController {
   @I18n("errors") t!: TFn;

   @Get("/not-found")
   notFound() {
      return { message: this.t("notFound") };
   }

   @Get("/unauthorized")
   unauthorized() {
      return { message: this.t("unauthorized") };
   }
}

@Controller("/validation")
class PrefixValidationController {
   @I18n("errors.validation") t!: TFn;

   @Get("/required")
   required(@Query("field") field: string) {
      return { message: this.t("required", { field }) };
   }

   @Get("/min-length")
   minLength(@Query("field") field: string, @Query("min") min: string) {
      return { message: this.t("minLength", { field, min }) };
   }
}

@Controller("/buttons")
class PrefixButtonController {
   @I18n("buttons") t!: TFn;

   @Get("/submit")
   submit() {
      return { label: this.t("submit") };
   }

   @Get("/cancel")
   cancel() {
      return { label: this.t("cancel") };
   }
}

@Controller("/pages")
class ResolveKeyController {
   @I18n("pages.home.title", true) homeTitle!: string;
   @I18n("pages.about.title", true) aboutTitle!: string;

   @Get("/home")
   home() {
      return { title: this.homeTitle };
   }

   @Get("/about")
   about() {
      return { title: this.aboutTitle };
   }
}

@Service()
class NotificationService {
   constructor(private i18n: I18nService) { }

   getWelcomeMessage(name: string): string {
      return this.i18n.t("welcome", { name });
   }

   getErrorMessage(type: string): string {
      return this.i18n.t(`errors.${type}`);
   }
}

@Controller("/notifications")
class NotificationController {
   constructor(private notificationService: NotificationService) { }

   @Get("/welcome/:name")
   welcome(@Params("name") name: string) {
      return { message: this.notificationService.getWelcomeMessage(name) };
   }

   @Get("/error/:type")
   error(@Params("type") type: string) {
      return { message: this.notificationService.getErrorMessage(type) };
   }
}

@Service()
class ButtonService {
   // No need for @I18n decorator when using direct t() function
   getButtonLabels() {
      // Using direct t() function with full key paths
      return {
         submit: t("buttons.submit"),
         cancel: t("buttons.cancel"),
         save: t("buttons.save"),
      };
   }
}

@Controller("/ui")
class UIController {
   constructor(private buttonService: ButtonService) { }

   @Get("/buttons")
   getButtons() {
      return this.buttonService.getButtonLabels();
   }
}

@Service()
class ErrorService {
   @I18n("errors") t!: TFn;

   getError(type: string): string {
      return this.t(type);
   }
}

@Service()
class PageService {
   @I18n("pages") t!: TFn;

   getPageInfo(page: string) {
      return {
         title: this.t(`${page}.title`),
         description: this.t(`${page}.description`),
      };
   }
}

@Controller("/app")
class AppController {
   constructor(
      private errorService: ErrorService,
      private pageService: PageService
   ) { }

   @Get("/error/:type")
   getError(@Params("type") type: string) {
      return { error: this.errorService.getError(type) };
   }

   @Get("/page/:name")
   getPage(@Params("name") name: string) {
      return this.pageService.getPageInfo(name);
   }
}

@Service()
class TypedService {
   @I18n() translate!: TFn;

   getMessage(key: string, params?: Record<string, string | number>): string {
      return this.translate(key, params);
   }
}

@Controller("/typed")
class TypedController {
   constructor(private service: TypedService) { }

   @Get("/message")
   getMessage(@Query("key") key: string, @Query("name") name?: string) {
      const params = name ? { name } : undefined;
      return { message: this.service.getMessage(key, params) };
   }
}

@Service()
class ErrorsService {
   @I18n("errors") getError!: TFn;

   getAllErrors() {
      return {
         notFound: this.getError("notFound"),
         unauthorized: this.getError("unauthorized"),
      };
   }
}

@Controller("/errors")
class ErrorsController {
   constructor(private service: ErrorsService) { }

   @Get("/all")
   getAll() {
      return this.service.getAllErrors();
   }
}

@Controller("/i18n")
class EdgeCaseController {
   constructor(private i18n: I18nService) { }

   @Get("/test")
   test() {
      return { message: this.i18n.t("any.key") };
   }

   @Get("/greeting")
   getGreeting() {
      return { message: this.i18n.t("greeting") };
   }

   @Get("/special")
   getSpecial() {
      return { message: this.i18n.t("special") };
   }

   @Get("/emoji")
   getEmoji() {
      return { message: this.i18n.t("emoji") };
   }

   @Get("/deep")
   getDeep() {
      return { message: this.i18n.t("level1.level2.level3.level4.value") };
   }
}

@Service()
class CheckoutService {
   @I18n("checkout") t!: TFn;

   getCartSummary(itemCount: number, total: number) {
      if (itemCount === 0) {
         return { message: this.t("cart.empty"), items: 0 };
      }
      return {
         items: this.t("cart.items", { count: itemCount }),
         total: this.t("cart.total", { amount: total }),
      };
   }

   getFormLabels() {
      return {
         email: this.t("form.email"),
         shipping: this.t("form.shipping"),
         payment: this.t("form.payment"),
      };
   }

   getButtons() {
      return {
         continue: this.t("buttons.continue"),
         checkout: this.t("buttons.checkout"),
         pay: this.t("buttons.pay"),
      };
   }
}

@Controller("/checkout")
class CheckoutController {
   constructor(private checkoutService: CheckoutService) { }

   @Get("/cart")
   getCart(@Query("count") count: string, @Query("total") total: string) {
      return this.checkoutService.getCartSummary(
         parseInt(count || "0"),
         parseFloat(total || "0")
      );
   }

   @Get("/form")
   getForm() {
      return this.checkoutService.getFormLabels();
   }

   @Get("/buttons")
   getButtons() {
      return this.checkoutService.getButtons();
   }
}

@Service()
class ApiErrorService {
   @I18n("api") t!: TFn;

   getHttpError(code: number): string {
      return this.t(`errors.${code}`);
   }

   getValidationError(
      type: string,
      field: string,
      params?: Record<string, any>
   ): string {
      return this.t(`validation.${type}`, { field, ...params });
   }
}

@Controller("/api")
class ApiController {
   constructor(private errorService: ApiErrorService) { }

   @Get("/error/:code")
   getError(@Params("code") code: string) {
      // Using direct t() for API error messages
      return {
         code: parseInt(code),
         message: t(`api.errors.${code}`),
      };
   }

   @Post("/validate")
   validate(@Body() body: { field: string; type: string; min?: number }) {
      // Using direct t() with interpolation for validation errors
      return {
         error: t(`api.validation.${body.type}`, {
            field: body.field,
            min: body.min || 0
         }),
      };
   }
}

@Controller("/datetime")
class DateTimeController {
   constructor(private i18n: I18nService) { }

   @Get("/format")
   getFormat() {
      return {
         language: this.i18n.getCurrentLanguage(),
         dateFormat: this.i18n.t("formats.date"),
         timeFormat: this.i18n.t("formats.time"),
         currency: this.i18n.t("formats.currency"),
      };
   }
}

// ==========================================
// RAW RESPONSE CONTROLLERS (No wrapping)
// ==========================================

/**
 * These controllers use @RawResponse() decorator to skip auto-wrapping.
 * Responses are returned as-is without the { data, status, message } wrapper.
 */

@Controller("/i18n-raw")
class BasicI18nRawController {
   constructor(private i18n: I18nService) { }

   @Get("/greeting")
   @RawResponse()
   getGreeting() {
      return {
         message: this.i18n.t("greeting"),
         language: this.i18n.getCurrentLanguage(),
      };
   }

   @Get("/welcome/:name")
   @RawResponse()
   getWelcome(@Params("name") name: string) {
      return { message: this.i18n.t("welcome", { name }) };
   }
}

@Controller("/errors-raw")
class ErrorsRawController {
   constructor(private service: ErrorsService) { }

   @Get("/all")
   @RawResponse()
   getAll() {
      return this.service.getAllErrors();
   }
}

// ==========================================
// TEST SUITE
// ==========================================

describe("I18n Integration Tests", () => {
   let server: Server;
   let baseURL: string;

   beforeEach(async () => {
      await reset();
   });

   afterEach(async () => {
      if (server) {
         await server.stop();
      }
   });

   describe("Basic Translation", () => {
      test("translates simple keys using I18nService.t()", async () => {
         const p = 5001;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const greetingResponse = await fetch(`${baseURL}/i18n/greeting`);
         const greetingData = await greetingResponse.json();
         expect(greetingData.message).toBe("Hello");

         const farewellResponse = await fetch(`${baseURL}/i18n/farewell`);
         const farewellData = await farewellResponse.json();
         expect(farewellData.message).toBe("Goodbye");
      });

      test("translates nested keys", async () => {
         const p = 5002;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(NestedKeysController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const notFoundResponse = await fetch(`${baseURL}/i18n/errors/not-found`);
         const notFoundData = await notFoundResponse.json();
         expect(notFoundData.message).toBe("Resource not found");

         const homeTitleResponse = await fetch(`${baseURL}/i18n/pages/home/title`);
         const homeTitleData = await homeTitleResponse.json();
         expect(homeTitleData.message).toBe("Home Page");

         const validationResponse = await fetch(`${baseURL}/i18n/errors/validation/required`);
         const validationData = await validationResponse.json();
         expect(validationData.message).toBe("Email is required");
      });

      test("returns key when translation not found", async () => {
         const p = 5003;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/missing`);
         const data = await response.json();
         expect(data.message).toBe("this.key.does.not.exist");
      });
   });

   describe("Parameter Interpolation", () => {
      test("interpolates single parameter", async () => {
         const p = 5004;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(InterpolationController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/welcome/John`);
         const data = await response.json();
         expect(data.message).toBe("Welcome, John!");
      });

      test("interpolates multiple parameters", async () => {
         const p = 5005;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(InterpolationController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/validation?field=Password&min=8`);
         const data = await response.json();
         expect(data.message).toBe("Password must be at least 8 characters");
      });
   });

   describe("Language Detection", () => {
      test("detects language from query string parameter", async () => {
         const p = 5006;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enResponse = await fetch(`${baseURL}/i18n/greeting`);
         const enData = await enResponse.json();
         expect(enData.message).toBe("Hello");
         expect(enData.language).toBe("en");

         const frResponse = await fetch(`${baseURL}/i18n/greeting?lang=fr`);
         const frData = await frResponse.json();
         expect(frData.message).toBe("Bonjour");
         expect(frData.language).toBe("fr");

         const arResponse = await fetch(`${baseURL}/i18n/greeting?lang=ar`);
         const arData = await arResponse.json();
         expect(arData.message).toBe("مرحبا");
         expect(arData.language).toBe("ar");
      });

      test("falls back to default when language not supported", async () => {
         const p = 5007;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting?lang=de`);
         const data = await response.json();
         expect(data.message).toBe("Hello");
         expect(data.language).toBe("en");
      });

      test("uses custom query string parameter name", async () => {
         const p = 5008;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               lookupQueryString: "locale",
            }))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting?locale=fr`);
         const data = await response.json();
         expect(data.message).toBe("Bonjour");
      });

      test("detects language from cookie", async () => {
         const p = 5009;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               order: ["cookie", "querystring", "header"],
            }))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting`, {
            headers: { Cookie: "language=fr" },
         });
         const data = await response.json();
         expect(data.message).toBe("Bonjour");
         expect(data.language).toBe("fr");
      });

      test("uses custom cookie name", async () => {
         const p = 5010;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               lookupCookie: "user_locale",
               order: ["cookie", "querystring", "header"],
            }))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting`, {
            headers: { Cookie: "user_locale=ar" },
         });
         const data = await response.json();
         expect(data.message).toBe("مرحبا");
      });

      test("respects detection order (querystring > cookie > header)", async () => {
         const p = 5011;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               order: ["querystring", "cookie", "header"],
            }))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting?lang=ar`, {
            headers: {
               Cookie: "language=fr",
               "Accept-Language": "en-US",
            },
         });
         const data = await response.json();
         expect(data.message).toBe("مرحبا");
      });

      test("falls through to next source when first is not found", async () => {
         const p = 5012;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               order: ["querystring", "cookie", "header"],
            }))
            .load(BasicI18nController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting`, {
            headers: {
               Cookie: "language=fr",
               "Accept-Language": "ar",
            },
         });
         const data = await response.json();
         expect(data.message).toBe("Bonjour");
      });
   });

   describe("Language Management", () => {
      test("setLanguage changes current language", async () => {
         const p = 5013;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(LanguageManagementController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/set/fr`);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.language).toBe("fr");
         expect(data.greeting).toBe("Bonjour");
      });

      test("setLanguage returns false for unsupported language", async () => {
         const p = 5014;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(LanguageManagementController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/set/de`);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.language).toBe("en");
      });

      test("getAvailableLanguages returns supported languages", async () => {
         const p = 5015;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(LanguageManagementController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/languages`);
         const data = await response.json();
         expect(data.languages).toEqual(["en", "fr", "ar"]);
      });

      test("isLanguageSupported checks language support", async () => {
         const p = 5016;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(LanguageManagementController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enResponse = await fetch(`${baseURL}/i18n/supported/en`);
         const enData = await enResponse.json();
         expect(enData.supported).toBe(true);

         const deResponse = await fetch(`${baseURL}/i18n/supported/de`);
         const deData = await deResponse.json();
         expect(deData.supported).toBe(false);
      });

      test("getDefaultLanguage returns configured default", async () => {
         const p = 5017;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               defaultLanguage: "fr",
            }))
            .load(LanguageManagementController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/default`);
         const data = await response.json();
         expect(data.defaultLanguage).toBe("fr");
      });

      test("setLanguage persists language to cookie", async () => {
         const p = 5018;
         server = await new Server()
            .use(i18n({
               ...defaultI18nConfig,
               order: ["cookie", "querystring", "header"],
            }))
            .load(LanguageManagementController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const setResponse = await fetch(`${baseURL}/i18n/set/fr`);
         const setCookie = setResponse.headers.get("set-cookie");

         expect(setCookie).toContain("language=fr");

         const currentResponse = await fetch(`${baseURL}/i18n/current`, {
            headers: { Cookie: setCookie || "" },
         });
         const currentData = await currentResponse.json();
         expect(currentData.language).toBe("fr");
         expect(currentData.greeting).toBe("Bonjour");
      });
   });

   describe("@I18n Decorator", () => {
      test("injects t function directly", async () => {
         const p = 5019;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(DecoratorBasicController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const greetingResponse = await fetch(`${baseURL}/i18n/greeting`);
         const greetingData = await greetingResponse.json();
         expect(greetingData.message).toBe("Hello");

         const welcomeResponse = await fetch(`${baseURL}/i18n/welcome/Alice`);
         const welcomeData = await welcomeResponse.json();
         expect(welcomeData.message).toBe("Welcome, Alice!");
      });

      test("uses prefix for translation keys", async () => {
         const p = 5020;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(PrefixErrorController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const notFoundResponse = await fetch(`${baseURL}/errors/not-found`);
         const notFoundData = await notFoundResponse.json();
         expect(notFoundData.message).toBe("Resource not found");

         const unauthorizedResponse = await fetch(`${baseURL}/errors/unauthorized`);
         const unauthorizedData = await unauthorizedResponse.json();
         expect(unauthorizedData.message).toBe("You are not authorized");
      });

      test("prefix works with nested keys", async () => {
         const p = 5021;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(PrefixValidationController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const requiredResponse = await fetch(`${baseURL}/validation/required?field=Username`);
         const requiredData = await requiredResponse.json();
         expect(requiredData.message).toBe("Username is required");

         const minLengthResponse = await fetch(`${baseURL}/validation/min-length?field=Password&min=8`);
         const minLengthData = await minLengthResponse.json();
         expect(minLengthData.message).toBe("Password must be at least 8 characters");
      });

      test("prefix with different languages", async () => {
         const p = 5022;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(PrefixButtonController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enResponse = await fetch(`${baseURL}/buttons/submit`);
         const enData = await enResponse.json();
         expect(enData.label).toBe("Submit");

         const frResponse = await fetch(`${baseURL}/buttons/submit?lang=fr`);
         const frData = await frResponse.json();
         expect(frData.label).toBe("Soumettre");
      });

      test("resolves specific key to property", async () => {
         const p = 5023;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(ResolveKeyController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const homeResponse = await fetch(`${baseURL}/pages/home`);
         const homeData = await homeResponse.json();
         expect(homeData.title).toBe("Home Page");

         const aboutResponse = await fetch(`${baseURL}/pages/about`);
         const aboutData = await aboutResponse.json();
         expect(aboutData.title).toBe("About Us");
      });

      test("resolved keys respond to language changes", async () => {
         const p = 5024;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(ResolveKeyController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enResponse = await fetch(`${baseURL}/pages/home`);
         const enData = await enResponse.json();
         expect(enData.title).toBe("Home Page");

         const frResponse = await fetch(`${baseURL}/pages/home?lang=fr`);
         const frData = await frResponse.json();
         expect(frData.title).toBe("Page d'accueil");
      });
   });

   describe("Service Layer Integration", () => {
      test("I18nService injected into services", async () => {
         const p = 5025;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(NotificationService, NotificationController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const welcomeResponse = await fetch(`${baseURL}/notifications/welcome/Bob`);
         const welcomeData = await welcomeResponse.json();
         expect(welcomeData.message).toBe("Welcome, Bob!");

         const errorResponse = await fetch(`${baseURL}/notifications/error/notFound`);
         const errorData = await errorResponse.json();
         expect(errorData.message).toBe("Resource not found");
      });

      test("@I18n decorator in services with prefix", async () => {
         const p = 5026;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(ButtonService, UIController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enResponse = await fetch(`${baseURL}/ui/buttons`);
         const enData = await enResponse.json();
         expect(enData.submit).toBe("Submit");
         expect(enData.cancel).toBe("Cancel");
         expect(enData.save).toBe("Save Changes");

         const frResponse = await fetch(`${baseURL}/ui/buttons?lang=fr`);
         const frData = await frResponse.json();
         expect(frData.submit).toBe("Soumettre");
         expect(frData.cancel).toBe("Annuler");
         expect(frData.save).toBe("Enregistrer");
      });

      test("multiple services with different prefixes", async () => {
         const p = 5027;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(ErrorService, PageService, AppController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const errorResponse = await fetch(`${baseURL}/app/error/unauthorized`);
         const errorData = await errorResponse.json();
         expect(errorData.error).toBe("You are not authorized");

         const pageResponse = await fetch(`${baseURL}/app/page/home`);
         const pageData = await pageResponse.json();
         expect(pageData.title).toBe("Home Page");
         expect(pageData.description).toBe("Welcome to our application");
      });
   });

   describe("Edge Cases", () => {
      test("handles empty translations object", async () => {
         const p = 5028;
         server = await new Server()
            .use(i18n({
               translations: {},
               defaultLanguage: "en",
               supportedLanguages: ["en"],
            }))
            .load(EdgeCaseController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/test`);
         const data = await response.json();
         expect(data.message).toBe("any.key");
      });

      test("handles translation with missing language", async () => {
         const p = 5029;
         server = await new Server()
            .use(i18n({
               translations: { en: enTranslations },
               defaultLanguage: "en",
               supportedLanguages: ["en", "fr", "ar"],
            }))
            .load(EdgeCaseController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/greeting?lang=fr`);
         const data = await response.json();
         expect(data.message).toBe("Hello");
      });

      test("handles special characters in translations", async () => {
         const p = 5030;
         server = await new Server()
            .use(i18n({
               translations: {
                  en: { special: "Hello <World> & \"Friends\"!" },
                  fr: { special: "Bonjour <Monde> & \"Amis\"!" },
               },
               defaultLanguage: "en",
               supportedLanguages: ["en", "fr"],
            }))
            .load(EdgeCaseController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/special`);
         const data = await response.json();
         expect(data.message).toBe("Hello <World> & \"Friends\"!");
      });

      test("handles unicode in translations", async () => {
         const p = 5031;
         server = await new Server()
            .use(i18n({
               translations: {
                  en: { emoji: "Hello 👋 World 🌍!" },
                  ar: { emoji: "مرحبا 👋 بالعالم 🌍!" },
               },
               defaultLanguage: "en",
               supportedLanguages: ["en", "ar"],
            }))
            .load(EdgeCaseController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enResponse = await fetch(`${baseURL}/i18n/emoji`);
         const enData = await enResponse.json();
         expect(enData.message).toBe("Hello 👋 World 🌍!");

         const arResponse = await fetch(`${baseURL}/i18n/emoji?lang=ar`);
         const arData = await arResponse.json();
         expect(arData.message).toBe("مرحبا 👋 بالعالم 🌍!");
      });

      test("handles deeply nested keys", async () => {
         const p = 5032;
         server = await new Server()
            .use(i18n({
               translations: {
                  en: {
                     level1: {
                        level2: {
                           level3: {
                              level4: {
                                 value: "Deep nested value",
                              },
                           },
                        },
                     },
                  },
               },
               defaultLanguage: "en",
               supportedLanguages: ["en"],
            }))
            .load(EdgeCaseController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/i18n/deep`);
         const data = await response.json();
         expect(data.message).toBe("Deep nested value");
      });
   });

   describe("Real-World Scenarios", () => {
      test("Multi-language e-commerce checkout", async () => {
         const p = 5033;
         server = await new Server()
            .use(i18n({
               translations: checkoutTranslations,
               defaultLanguage: "en",
               supportedLanguages: ["en", "fr"],
            }))
            .load(CheckoutService, CheckoutController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const enCart = await fetch(`${baseURL}/checkout/cart?count=3&total=99.99`);
         const enCartData = await enCart.json();
         expect(enCartData.items).toBe("3 items in cart");
         expect(enCartData.total).toBe("Total: $99.99");

         const frCart = await fetch(`${baseURL}/checkout/cart?count=3&total=99.99&lang=fr`);
         const frCartData = await frCart.json();
         expect(frCartData.items).toBe("3 articles dans le panier");
         expect(frCartData.total).toBe("Total: 99.99€");
      });

      test("API error responses with localization", async () => {
         const p = 5034;
         server = await new Server()
            .use(i18n({
               translations: apiTranslations,
               defaultLanguage: "en",
               supportedLanguages: ["en", "ar"],
            }))
            .load(ApiErrorService, ApiController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const ar401 = await fetch(`${baseURL}/api/error/401?lang=ar`);
         const ar401Data = await ar401.json();
         expect(ar401Data.message).toBe("غير مصرح - يرجى تسجيل الدخول");

         const enValidation = await fetch(`${baseURL}/api/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field: "Password", type: "tooShort", min: 8 }),
         });
         const enData = await enValidation.json();
         expect(enData.error).toBe("Password must be at least 8 characters");
      });

      test("Date/time formatting context", async () => {
         const p = 5035;
         server = await new Server()
            .use(i18n({
               translations: {
                  en: {
                     formats: {
                        date: "MM/DD/YYYY",
                        time: "hh:mm A",
                        currency: "USD",
                     },
                  },
                  fr: {
                     formats: {
                        date: "DD/MM/YYYY",
                        time: "HH:mm",
                        currency: "EUR",
                     },
                  },
                  ar: {
                     formats: {
                        date: "YYYY/MM/DD",
                        time: "HH:mm",
                        currency: "MAD",
                     },
                  },
               },
               defaultLanguage: "en",
               supportedLanguages: ["en", "fr", "ar"],
            }))
            .load(DateTimeController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const frResponse = await fetch(`${baseURL}/datetime/format?lang=fr`);
         const frData = await frResponse.json();
         expect(frData.dateFormat).toBe("DD/MM/YYYY");
         expect(frData.currency).toBe("EUR");
      });
   });

   describe("Type Safety with TFn", () => {
      test("TFn type works correctly with @I18n decorator", async () => {
         const p = 5036;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(TypedService, TypedController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const greetingResponse = await fetch(`${baseURL}/typed/message?key=greeting`);
         const greetingData = await greetingResponse.json();
         expect(greetingData.message).toBe("Hello");

         const welcomeResponse = await fetch(`${baseURL}/typed/message?key=welcome&name=TypeScript`);
         const welcomeData = await welcomeResponse.json();
         expect(welcomeData.message).toBe("Welcome, TypeScript!");
      });

      test("TFn with prefix returns correct function signature", async () => {
         const p = 5037;
         server = await new Server()
            .use(i18n(defaultI18nConfig))
            .load(ErrorsService, ErrorsController)
            .listen(p);

         baseURL = `http://localhost:${p}`;

         const response = await fetch(`${baseURL}/errors/all`);
         const data = await response.json();
         expect(data.notFound).toBe("Resource not found");
         expect(data.unauthorized).toBe("You are not authorized");
      });
   });
});
