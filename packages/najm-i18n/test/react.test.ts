import { afterEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const testWindow = new Window({ url: 'http://localhost' });
Object.assign(globalThis, {
   window: testWindow,
   document: testWindow.document,
   DocumentFragment: testWindow.DocumentFragment,
   HTMLElement: testWindow.HTMLElement,
   Element: testWindow.Element,
   Node: testWindow.Node,
   navigator: testWindow.navigator,
   MutationObserver: testWindow.MutationObserver,
});

const React = await import('react');
const { cleanup, fireEvent, render, screen, waitFor } =
   await import('@testing-library/react');
const { I18nProvider, useTranslation } = await import('../src/react');

afterEach(() => {
   cleanup();
   document.body.innerHTML = '';
   document.documentElement.lang = '';
   document.documentElement.dir = '';
});

const translations = {
   en: { greeting: 'Hello', onlyInBase: 'Base only' },
   fr: { greeting: 'Bonjour' },
   ar: { greeting: 'مرحبا' },
};

function Probe() {
   const { t, language, changeLanguage } = useTranslation<'greeting', 'en' | 'fr' | 'ar'>();
   return React.createElement(
      React.Fragment,
      null,
      React.createElement('output', null, `${language}:${t('greeting')}`),
      React.createElement(
         'button',
         { type: 'button', onClick: () => void changeLanguage('fr') },
         'French',
      ),
      React.createElement(
         'button',
         { type: 'button', onClick: () => void changeLanguage('ar') },
         'Arabic',
      ),
   );
}

describe('React i18n adapter', () => {
   test('changes language immediately without a page refresh and persists in the background', async () => {
      const persisted: string[] = [];
      render(React.createElement(
         I18nProvider,
         {
            translations,
            initialLanguage: 'en',
            onLanguageChange: async (language) => { persisted.push(language); },
         },
         React.createElement(Probe),
      ));

      expect(screen.getByText('en:Hello')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'French' }));
      expect(screen.getByText('fr:Bonjour')).toBeTruthy();
      expect(document.documentElement.lang).toBe('fr');
      expect(document.documentElement.dir).toBe('ltr');
      await waitFor(() => expect(persisted).toEqual(['fr']));

      fireEvent.click(screen.getByRole('button', { name: 'Arabic' }));
      expect(screen.getByText('ar:مرحبا')).toBeTruthy();
      expect(document.documentElement.dir).toBe('rtl');
   });

   test('per-key fallback follows language changes when enabled', async () => {
      function FallbackProbe() {
         const { t, language, changeLanguage } = useTranslation<
            'greeting' | 'onlyInBase' | 'nowhere',
            'en' | 'fr'
         >();
         return React.createElement(
            React.Fragment,
            null,
            React.createElement(
               'output',
               null,
               `${language}|${t('greeting')}|${t('onlyInBase')}|${t('nowhere')}`,
            ),
            React.createElement(
               'button',
               { type: 'button', onClick: () => void changeLanguage('fr') },
               'French',
            ),
         );
      }

      render(React.createElement(
         I18nProvider,
         {
            translations,
            initialLanguage: 'en',
            defaultLanguage: 'en',
            fallbackToDefaultLanguage: true,
         },
         React.createElement(FallbackProbe),
      ));

      expect(screen.getByText('en|Hello|Base only|nowhere')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'French' }));
      // `greeting` is translated, `onlyInBase` falls back, `nowhere` still echoes.
      expect(screen.getByText('fr|Bonjour|Base only|nowhere')).toBeTruthy();
   });

   test('omitting the option keeps the key echo', () => {
      function StrictProbe() {
         const { t } = useTranslation<'onlyInBase', 'en' | 'fr'>();
         return React.createElement('output', null, t('onlyInBase'));
      }

      render(React.createElement(
         I18nProvider,
         { translations, initialLanguage: 'fr', defaultLanguage: 'en' },
         React.createElement(StrictProbe),
      ));

      expect(screen.getByText('onlyInBase')).toBeTruthy();
   });

   test('uses application direction metadata for non-Arabic RTL languages', () => {
      function HebrewProbe() {
         const { changeLanguage } = useTranslation<'greeting', 'en' | 'he'>();
         return React.createElement(
            'button',
            { type: 'button', onClick: () => void changeLanguage('he') },
            'Hebrew',
         );
      }

      render(React.createElement(
         I18nProvider,
         {
            translations: {
               en: { greeting: 'Hello' },
               he: { greeting: 'Shalom' },
            },
            initialLanguage: 'en',
            getLanguageDirection: (language) => language === 'he' ? 'rtl' : 'ltr',
         },
         React.createElement(HebrewProbe),
      ));

      fireEvent.click(screen.getByRole('button', { name: 'Hebrew' }));
      expect(document.documentElement.lang).toBe('he');
      expect(document.documentElement.dir).toBe('rtl');
   });

});
