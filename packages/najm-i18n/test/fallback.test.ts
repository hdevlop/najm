import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Controller, Get, Params, reset, Server, Service } from 'najm-core';

import { I18n, i18n, I18nService, type TFn } from '../src';

// `fr` is deliberately incomplete: it has `greeting` but not `onlyInBase`, which
// is the shape every application that ships a partial locale actually has.
const translations = {
   en: {
      greeting: 'Hello',
      onlyInBase: 'Base only, {{name}}',
      nested: { deep: 'Deep base' },
   },
   fr: {
      greeting: 'Bonjour',
      nested: {},
   },
};

const baseConfig = {
   translations,
   defaultLanguage: 'en',
   supportedLanguages: ['en', 'fr'],
};

@Service()
class MessageService {
   @I18n() t!: TFn;

   read(key: string, name?: string) {
      return this.t(key, name ? { name } : undefined);
   }
}

@Controller('/msg')
class MessageController {
   constructor(
      private service: MessageService,
      private i18nService: I18nService,
   ) {}

   @Get('/service/:key')
   viaService(@Params('key') key: string) {
      return { message: this.service.read(key, 'Amina') };
   }

   @Get('/direct/:key')
   viaService2(@Params('key') key: string) {
      return { message: this.i18nService.t(key, { name: 'Amina' }) };
   }
}

async function boot(port: number, fallbackToDefaultLanguage: boolean) {
   return await new Server()
      .use(i18n({ ...baseConfig, fallbackToDefaultLanguage }))
      .load(MessageService, MessageController)
      .listen(port);
}

async function read(port: number, path: string, language: string) {
   const response = await fetch(`http://localhost:${port}${path}?lang=${language}`);
   return (await response.json()).message as string;
}

describe('server-path missing-key fallback', () => {
   let server: Server;

   beforeEach(async () => {
      await reset();
   });

   afterEach(async () => {
      if (server) await server.stop();
   });

   test('omitted or false still echoes a missing key', async () => {
      const port = 5101;
      server = await boot(port, false);

      expect(await read(port, '/msg/service/greeting', 'fr')).toBe('Bonjour');
      expect(await read(port, '/msg/service/onlyInBase', 'fr')).toBe('onlyInBase');
      expect(await read(port, '/msg/direct/nested.deep', 'fr')).toBe('nested.deep');
   });

   test('enabled resolves the base catalog and interpolates it', async () => {
      const port = 5102;
      server = await boot(port, true);

      expect(await read(port, '/msg/service/greeting', 'fr')).toBe('Bonjour');
      expect(await read(port, '/msg/service/onlyInBase', 'fr'))
         .toBe('Base only, Amina');
      expect(await read(port, '/msg/direct/nested.deep', 'fr')).toBe('Deep base');
   });

   test('a key in neither catalog still echoes when enabled', async () => {
      const port = 5103;
      server = await boot(port, true);

      expect(await read(port, '/msg/service/no.such.key', 'fr')).toBe('no.such.key');
   });

   test('the default language itself is unaffected', async () => {
      const port = 5104;
      server = await boot(port, true);

      expect(await read(port, '/msg/service/greeting', 'en')).toBe('Hello');
      expect(await read(port, '/msg/service/no.such.key', 'en')).toBe('no.such.key');
   });
});
