import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Controller, Get, Server, reset } from "najm-core";
import { i18n, I18nService, resolveDetectionDefaults, type I18nOptions } from "../src";

const translations = {
   en: { greeting: "Hello" },
   fr: { greeting: "Bonjour" },
   ar: { greeting: "مرحبا" },
};

const base: I18nOptions = {
   translations,
   defaultLanguage: "en",
   supportedLanguages: ["en", "fr", "ar"],
};

@Controller("/preset")
class GreetingController {
   constructor(private i18n: I18nService) { }

   @Get("/greeting")
   greeting() {
      return { message: this.i18n.t("greeting"), language: this.i18n.getCurrentLanguage() };
   }
}

describe("resolveDetectionDefaults", () => {
   test("keeps the package defaults without the preset", () => {
      expect(resolveDetectionDefaults({})).toEqual({
         order: ["cookie", "querystring", "header"],
         lookupFromHeaderKey: "language",
         caches: ["cookie"],
      });
   });

   test("the server preset reads its header first and caches nothing", () => {
      expect(resolveDetectionDefaults({ server: { languageHeader: "X-Language" } })).toEqual({
         order: ["header", "cookie", "querystring"],
         lookupFromHeaderKey: "X-Language",
         caches: [],
      });
   });

   test("explicit options win over the preset", () => {
      expect(resolveDetectionDefaults({
         server: { languageHeader: "X-Language" },
         order: ["querystring"],
         lookupFromHeaderKey: "X-Other",
         caches: ["cookie"],
      })).toEqual({ order: ["querystring"], lookupFromHeaderKey: "X-Other", caches: ["cookie"] });
   });
});

describe("server preset over requests", () => {
   let server: Server | undefined;
   let url: string;

   async function start(port: number, options: I18nOptions) {
      server = await new Server({ silent: true }).use(i18n(options)).load(GreetingController).listen(port);
      url = `http://localhost:${port}/preset/greeting`;
   }

   const get = async (init: { header?: string; cookie?: string; query?: string } = {}) => {
      const headers: Record<string, string> = {};
      if (init.header !== undefined) headers["X-Language"] = init.header;
      if (init.cookie !== undefined) headers.Cookie = `language=${init.cookie}`;
      const response = await fetch(init.query ? `${url}?lang=${init.query}` : url, { headers });
      return { body: await response.json() as { message: string; language: string }, setCookie: response.headers.get("set-cookie") };
   };

   beforeEach(async () => {
      await reset();
   });

   afterEach(async () => {
      await server?.stop();
      server = undefined;
   });

   test("the header wins over a conflicting cookie and query", async () => {
      await start(5331, { ...base, server: { languageHeader: "X-Language" } });

      expect((await get({ header: "fr", cookie: "en", query: "en" })).body.message).toBe("Bonjour");
      expect((await get({ header: "ar", cookie: "en", query: "fr" })).body.message).toBe("مرحبا");
   });

   test("without the header the cookie wins over the query, then the query, then the default", async () => {
      await start(5332, { ...base, server: { languageHeader: "X-Language" } });

      expect((await get({ cookie: "fr", query: "ar" })).body.message).toBe("Bonjour");
      expect((await get({ query: "ar" })).body.message).toBe("مرحبا");
      expect((await get()).body.message).toBe("Hello");
   });

   test("an unsupported header falls through to the next source, never to a raw key", async () => {
      await start(5333, { ...base, server: { languageHeader: "X-Language" } });

      expect((await get({ header: "de", cookie: "fr" })).body.message).toBe("Bonjour");
      expect((await get({ header: "de" })).body.message).toBe("Hello");
   });

   test("one cookie jar across changing headers follows each header and is never written", async () => {
      await start(5334, { ...base, server: { languageHeader: "X-Language" } });

      const seen: string[] = [];
      for (const header of ["fr", "en", "ar", "fr"]) {
         const { body, setCookie } = await get({ header, cookie: "en" });
         seen.push(body.language);
         expect(setCookie).toBeNull();
      }
      expect(seen).toEqual(["fr", "en", "ar", "fr"]);
   });

   test("without the preset the defaults are unchanged: cookie first, and detection caches it", async () => {
      await start(5335, { ...base });

      const fromCookie = await get({ header: "fr", cookie: "ar" });
      expect(fromCookie.body.message).toBe("مرحبا");
      expect((await get({ query: "fr" })).setCookie).toContain("language=fr");
   });
});
