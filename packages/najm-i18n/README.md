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
}
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