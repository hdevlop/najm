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
   en: { greeting: 'Hello' },
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
});
