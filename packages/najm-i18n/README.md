# najm-i18n

Internationalization (i18n) plugin for the Najm framework with automatic language detection, translation management, and decorator-based injection.

## Features

- 🌍 **Multi-language support** - Define translations for multiple languages
- 🔍 **Automatic language detection** - From headers, cookies, query strings, or URL path
- 💉 **Decorator-based injection** - Clean, type-safe translation functions
- 🎯 **Prefixed translations** - Organize translations with automatic key prefixes
- 🔄 **Parameter interpolation** - Dynamic values in translations with `{{variable}}` syntax
- 🍪 **Cookie persistence** - Remembers user language preference
- ⚡ **AsyncLocalStorage** - Request-scoped language detection
- 🎨 **Flexible configuration** - Multiple detection strategies and fallback options

## Installation

```bash
bun add najm-i18n
```

## Quick Start

```typescript
import { Server, Controller, Get } from 'najm-core';
import { i18n, I18n, type TFn } from 'najm-i18n';

// Define translations
const translations = {
  en: {
    hello: 'Hello',
    welcome: 'Welcome {{name}}!',
    errors: {
      notFound: 'Not found',
    },
  },
  fr: {
    hello: 'Bonjour',
    welcome: 'Bienvenue {{name}}!',
    errors: {
      notFound: 'Non trouvé',
    },
  },
};

@Controller('/api')
class ApiController {
  @I18n()
  t!: TFn;

  @Get('/greet')
  greet() {
    return { message: this.t('hello') };
  }

  @Get('/welcome/:name')
  welcome(@Params('name') name: string) {
    return { message: this.t('welcome', { name }) };
  }
}

// Initialize server with i18n plugin
new Server()
  .use(i18n({
    translations,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'fr'],
  }))
  .load(ApiController)
  .listen(3000);
```

## Configuration

### Plugin Options

```typescript
interface I18nOptions {
  // Translation data (key-value pairs per language)
  translations: Record<string, Record<string, any>>;

  // Default language to use when detection fails
  defaultLanguage?: string;  // Default: 'en'

  // List of supported languages
  supportedLanguages?: string[];  // Default: ['en']

  // Language detection order
  order?: ('querystring' | 'header' | 'cookie' | 'path')[];  // Default: ['cookie', 'querystring', 'header']

  // Query string parameter name
  lookupQueryString?: string;  // Default: 'lang'

  // Cookie name for language storage
  lookupCookie?: string;  // Default: 'language'

  // Header key for language detection
  lookupFromHeaderKey?: string;  // Default: 'language'

  // URL path index for language detection
  lookupFromPathIndex?: number;  // Default: 0

  // Cache detected language in cookie
  caches?: ('cookie')[];  // Default: ['cookie']

  // Cookie configuration
  cookieOptions?: {
    path?: string;
    domain?: string;
    sameSite?: 'Strict' | 'Lax' | 'None';
    secure?: boolean;
    maxAge?: number;
    httpOnly?: boolean;
  };

  // Case-insensitive language matching
  ignoreCase?: boolean;  // Default: true

  // Convert detected language code
  convertDetectedLanguage?: (lang: string) => string;

  // Enable debug logging
  debug?: boolean;  // Default: false

  // Resolve a key missing from the detected language against defaultLanguage
  // instead of echoing the key. See "Missing-key fallback".
  fallbackToDefaultLanguage?: boolean;  // Default: false
}
```

### Missing-key fallback

By default a key that is absent from the active language renders as the key
itself. That is deliberate: an untranslated string stays visible in the UI and
in `najm-kit`'s label diagnostics instead of being papered over.

An application that ships an incomplete locale beside a complete one usually
wants the opposite — a key added to the base catalog should render readable text
everywhere until its translation lands. Set `fallbackToDefaultLanguage: true`
and the lookup falls through to `defaultLanguage` before echoing.

The option never affects an entirely absent language. That already resolves
against `defaultLanguage`, with or without it:

| Selected language | Selected key | `fallbackToDefaultLanguage` | Result |
| --- | --- | --- | --- |
| exists | exists | either | selected-language value |
| absent | default has the key | either | default-language value |
| exists | absent | `false` / omitted | key echo |
| exists | absent | `true` | default-language value |
| exists | absent in both | `true` | key echo |

The same option is accepted by `translate()`, `createTranslator()`, the server
plugin, `defineI18n()`, and `I18nProvider`, so an application that uses one
catalog on both sides configures the policy once and both paths agree.

```typescript
translate(translations, 'fr', 'orders.title', undefined, {
  defaultLanguage: 'en',
  fallbackToDefaultLanguage: true,
});
```

### Basic Configuration

```typescript
new Server()
  .use(i18n({
    translations: {
      en: { hello: 'Hello' },
      fr: { hello: 'Bonjour' },
    },
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'fr'],
  }))
  .load(/* controllers */)
  .listen(3000);
```

### Production Configuration

```typescript
new Server()
  .use(i18n({
    translations: {
      en: require('./locales/en.json'),
      fr: require('./locales/fr.json'),
      es: require('./locales/es.json'),
      de: require('./locales/de.json'),
    },
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'fr', 'es', 'de'],
    order: ['cookie', 'header', 'querystring'],
    lookupCookie: 'user_lang',
    cookieOptions: {
      secure: true,
      sameSite: 'Strict',
      maxAge: 365 * 24 * 60 * 60, // 1 year
    },
  }))
  .load(/* controllers */)
  .listen(3000);
```

## React Usage

Use the optional `najm-i18n/react` entry point in client-rendered React trees.
The provider updates subscribed components immediately; persistence can happen
asynchronously through `onLanguageChange`.

```tsx
import { I18nProvider, useTranslation } from 'najm-i18n/react';

function LanguageButton() {
  const { t, changeLanguage } = useTranslation();

  return (
    <button onClick={() => void changeLanguage('fr')}>
      {t('language.french')}
    </button>
  );
}

export function App() {
  return (
    <I18nProvider
      translations={translations}
      initialLanguage="en"
      onLanguageChange={(language) => saveLanguage(language)}
    >
      <LanguageButton />
    </I18nProvider>
  );
}
```

The root `najm-i18n` entry remains server-safe and exposes the imperative
`t`, `translate`, and `createTranslator` APIs. React is an optional peer and is
loaded only through `najm-i18n/react`.

### Typed keys without a wrapper hook

`useTranslation<Key, Language>()` accepts explicit generics, but repeating them
at every call site is what pushes applications into writing a wrapper hook whose
only job is to bind them once. Register the two unions instead, in one ambient
declaration per TypeScript program:

```ts
// najm-i18n.d.ts
import type { TranslationKeys } from 'najm-i18n';
import type en from '@acme/server/locales/en.json';

declare module 'najm-i18n/react' {
  interface NajmI18nRegistry {
    key: TranslationKeys<(typeof en)['ui']>;
    language: 'ar' | 'en' | 'es' | 'fr';
  }
}
```

Every direct import is then typed with no call-site generics and no app hook:

```tsx
import { useTranslation } from 'najm-i18n/react';

const { t, language, changeLanguage } = useTranslation();
t('operator.orders.title');   // checked against the catalog
t('operator.orders.titel');   // compile error
changeLanguage('de');         // compile error
```

`TranslationKeys<Catalog>` is exported from the root entry and produces every
dotted path in a catalog that ends at a string. On a 1,700-key catalog it adds
under 0.1s to a `tsc` check.

**One registration per TypeScript program.** React cannot infer these unions
from the provider — the hook and the provider are different call sites — so the
registry is program-wide rather than per-provider. A program with a second,
independent catalog keeps using explicit generics, which still override the
registry:

```ts
const { t } = useTranslation<'only.this', 'de'>();
```

A program that registers nothing behaves exactly as before: both parameters
default to `string`.

## Defining a catalog once

`defineI18n` is a server-safe, framework-neutral helper that binds a catalog to
its language union, its fallback policy, and the per-language facts an
application would otherwise re-declare in three places. It imports no React, no
Next.js, and no `najm-core`.

```ts
import { defineI18n } from 'najm-i18n';
import translations from '@acme/server/locales';

export const appI18n = defineI18n({
  translations,
  defaultLanguage: 'en',
  fallbackToDefaultLanguage: true,
  languageMetadata: {
    en: { locale: 'en-MA', direction: 'ltr' },
    fr: { locale: 'fr-MA', direction: 'ltr' },
    ar: { locale: 'ar-MA', direction: 'rtl' },
  },
});

export const appUiI18n = appI18n.scope('ui');
```

The definition exposes:

| Member | Purpose |
| --- | --- |
| `translations`, `defaultLanguage`, `supportedLanguages` | the catalog and its inferred, frozen language union |
| `isLanguage(v)`, `normalizeLanguage(v)` | a type guard and a total coercion to the default |
| `translate(lang, key, params)`, `createTranslator(lang)` | translation with the fallback policy already bound |
| `locale(lang)`, `direction(lang)` | BCP 47 tag and writing direction from `languageMetadata` |
| `scope(prefix)` | the same definition projected onto a nested branch |
| `options` | config to hand straight to the `i18n()` server plugin |

`scope` reuses the nested objects **by reference** — a UI scope of a 100 KB
catalog is read on every render, so it is never cloned. A language missing the
branch is dropped from the scope and covered by the fallback policy; a branch
missing from the *default* language throws, because every lookup through such a
scope would silently echo keys.

`direction` is declared per language rather than derived. Arabic is not the only
RTL language, and an application adding Hebrew or Persian should not have to
discover a hard-coded list.

## Usage

### 1. Direct Translation Function

Inject the translation function directly:

```typescript
@Injectable()
class UserService {
  @I18n()
  t!: TFn;

  greet() {
    return this.t('hello');
  }

  welcomeUser(name: string) {
    return this.t('welcome', { name });
  }
}
```

### 2. Prefixed Translation Function

Automatically prefix all translation keys:

```typescript
@Injectable()
class ErrorService {
  @I18n('errors')  // All keys prefixed with 'errors.'
  t!: TFn;

  notFound() {
    return this.t('notFound');  // Translates 'errors.notFound'
  }

  forbidden() {
    return this.t('forbidden');  // Translates 'errors.forbidden'
  }
}
```

### 3. Resolved Key (Static Translation)

Get a specific translated value as a property:

```typescript
@Injectable()
class HomeService {
  @I18n('welcome.title', true)  // Resolve 'welcome.title' key
  title!: string;  // Returns translated value

  getTitle() {
    return this.title;  // No function call needed
  }
}
```

### 4. Nested Translation Keys

Access deeply nested translations using dot notation:

```typescript
const translations = {
  en: {
    user: {
      profile: {
        title: 'User Profile',
        settings: {
          privacy: 'Privacy Settings',
        },
      },
    },
  },
};

@Injectable()
class UserService {
  @I18n() t!: TFn;

  getProfileTitle() {
    return this.t('user.profile.title');
  }

  getPrivacySettings() {
    return this.t('user.profile.settings.privacy');
  }
}
```

### 5. Parameter Interpolation

Use `{{variable}}` syntax for dynamic values:

```typescript
const translations = {
  en: {
    greeting: 'Hello {{name}}, you have {{count}} messages',
    itemCount: '{{count}} item(s) found',
  },
};

@Injectable()
class MessageService {
  @I18n()
  t!: TFn;

  greet(name: string, count: number) {
    return this.t('greeting', { name, count });
  }

  showCount(count: number) {
    return this.t('itemCount', { count });
  }
}
```

## Language Detection

The plugin detects language from multiple sources in configurable order:

### 1. From Cookie

```bash
# Cookie: language=fr
GET /api/greet
```

### 2. From Query String

```bash
GET /api/greet?lang=fr
```

### 3. From Header

```bash
GET /api/greet
Accept-Language: fr-FR,fr;q=0.9,en;q=0.8
```

### 4. From URL Path

```typescript
// With lookupFromPathIndex: 0
GET /fr/api/greet  // Language: fr
GET /en/api/greet  // Language: en
```

## Language Management API

The `I18nService` provides methods to manage languages programmatically:

```typescript
import { I18nService } from 'najm-i18n';

@Injectable()
class LanguageController {
  constructor(private i18nService: I18nService) {}

  // Get current language
  getCurrentLang() {
    return this.i18nService.getCurrentLanguage();  // e.g., 'en'
  }

  // Set language (updates cookie)
  setLanguage(lang: string) {
    const success = this.i18nService.setLanguage(lang);
    return { success };
  }

  // Get available languages
  getAvailableLanguages() {
    return this.i18nService.getAvailableLanguages();  // e.g., ['en', 'fr', 'es']
  }

  // Check if language is supported
  isSupported(lang: string) {
    return this.i18nService.isLanguageSupported(lang);
  }

  // Get default language
  getDefaultLang() {
    return this.i18nService.getDefaultLanguage();
  }
}
```

## Translation File Organization

### Flat Structure

```typescript
const translations = {
  en: {
    'user.name': 'Name',
    'user.email': 'Email',
    'button.submit': 'Submit',
  },
};
```

### Nested Structure (Recommended)

```typescript
const translations = {
  en: {
    user: {
      name: 'Name',
      email: 'Email',
      profile: {
        title: 'User Profile',
        edit: 'Edit Profile',
      },
    },
    button: {
      submit: 'Submit',
      cancel: 'Cancel',
    },
  },
};
```

### External JSON Files

```typescript
// locales/en.json
{
  "hello": "Hello",
  "welcome": "Welcome {{name}}",
  "errors": {
    "notFound": "Not found",
    "serverError": "Server error"
  }
}

// Load in server
import en from './locales/en.json';
import fr from './locales/fr.json';

new Server()
  .use(i18n({
    translations: { en, fr },
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'fr'],
  }))
  .load(/* controllers */)
  .listen(3000);
```

## Examples

### Multi-Language API

```typescript
import { Server, Controller, Get, Injectable } from 'najm-core';
import { i18n, I18n, type TFn } from 'najm-i18n';

const translations = {
  en: {
    welcome: 'Welcome to our API',
    user: {
      notFound: 'User not found',
      created: 'User {{name}} created successfully',
    },
  },
  fr: {
    welcome: 'Bienvenue sur notre API',
    user: {
      notFound: 'Utilisateur non trouvé',
      created: 'Utilisateur {{name}} créé avec succès',
    },
  },
};

@Injectable()
class UserService {
  @I18n('user')
  t!: TFn;

  createUser(name: string) {
    return this.t('created', { name });
  }

  notFound() {
    return this.t('notFound');
  }
}

@Controller('/api')
class ApiController {
  @I18n()
  t!: TFn;

  constructor(private userService: UserService) {}

  @Get('/welcome')
  welcome() {
    return { message: this.t('welcome') };
  }

  @Post('/users')
  createUser(@Body() data: { name: string }) {
    return { message: this.userService.createUser(data.name) };
  }

  @Get('/users/:id')
  getUser(@Params('id') id: string) {
    // Simulate user not found
    throw new HttpError(404, this.userService.notFound());
  }
}

new Server()
  .use(i18n({
    translations,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'fr'],
  }))
  .load(ApiController, UserService)
  .listen(3000);

// Test:
// curl http://localhost:3000/api/welcome
// { "message": "Welcome to our API" }

// curl -H "Accept-Language: fr" http://localhost:3000/api/welcome
// { "message": "Bienvenue sur notre API" }
```

## Best Practices

1. **Organize by domain**: Group related translations together
2. **Use nested keys**: Makes translations more maintainable
3. **Consistent naming**: Use dot notation consistently
4. **Parameter naming**: Use descriptive parameter names in interpolations
5. **Fallback values**: Always provide default language translations
6. **Prefix decorators**: Use prefixed `@I18n('domain')` to reduce repetition
7. **Type safety**: Use `TFn` type for translation functions

## Migration from Core

If you're migrating from `najm-core` with built-in i18n:

```typescript
// Before (core)
import { Server } from 'najm-core';

new Server({
  i18n: {
    translations: { /* ... */ },
    defaultLanguage: 'en',
  },
}).listen(3000);

// After (plugin)
import { Server } from 'najm-core';
import { i18n } from 'najm-i18n';

new Server()
  .use(i18n({
    translations: { /* ... */ },
    defaultLanguage: 'en',
  }))
  .listen(3000);
```

## License

MIT
