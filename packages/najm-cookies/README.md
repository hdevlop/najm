# najm-cookies

Cookie handling plugin for Najm API framework. Provides both property-level service injection and parameter-level cookie extraction.

## Installation

```bash
bun add najm-cookies
```

## Usage

```typescript
import { Server } from 'najm-core';
import { cookies } from 'najm-cookies';

new Server()
  .use(cookies({
    prefix: 'app_',
    secure: true,
  }))
  .load(YourController)
  .listen(3000);
```

## Decorators

### @Cookie() - Parameter Decorator

Quick read-only access to cookie values in method parameters.

```typescript
import { Cookie } from 'najm-cookies';

class UserController {
   @Get('/profile')
   getProfile(
      @Cookie() allCookies: Record<string, string>,  // All cookies
      @Cookie('sessionId') sessionId: string         // Specific cookie
   ) {
      return { sessionId, allCookies };
   }
   
   @Get('/check')
   checkAuth(@Cookie('token') token: string) {
      return { authenticated: !!token };
   }
}
```

### @Cookies() - Property Decorator

Full CookieService injection for read/write operations.

```typescript
import { Cookies, CookieService } from 'najm-cookies';

class AuthController {
   @Cookies() 
   private cookies!: CookieService;
   
   // With options
   @Cookies({ prefix: 'auth_', secret: 'my-secret' }) 
   private authCookies!: CookieService;

   @Post('/login')
   login() {
      this.cookies.set('token', 'abc123');
      this.authCookies.setSigned('session', 'data', 'secret');
      return { success: true };
   }

   @Post('/logout')
   logout() {
      this.cookies.delete('token');
      return { success: true };
   }
}
```

## When to Use Which?

| Scenario | Decorator |
|----------|-----------|
| **Read cookie in handler params** | `@Cookie('name')` |
| **Read all cookies** | `@Cookie()` |
| **Set/Delete cookies** | `@Cookies()` |
| **Signed cookies** | `@Cookies()` |
| **JSON cookies** | `@Cookies()` |
| **Cookie prefixing** | `@Cookies({ prefix: 'x_' })` |

## CookieService API

### Core Methods
- `get(name)`: Get cookie value
- `set(name, value, options?)`: Set cookie value
- `delete(name, options?)`: Delete cookie
- `has(name)`: Check if cookie exists
- `getAll()`: Get all cookies

### Convenience Methods
- `setSecure(name, value, options?)`: Set with httpOnly, secure, sameSite=Strict
- `setSession(name, value, options?)`: Session cookie (no maxAge/expires)
- `setPersistent(name, value, days?, options?)`: Persistent cookie with expiry

### Signed Cookies
- `getSigned(name, secret)`: Get and verify signed cookie
- `setSigned(name, value, secret, options?)`: Set signed cookie

### JSON Cookies
- `getJSON<T>(name)`: Get and parse JSON cookie
- `setJSON(name, value, options?)`: Set JSON cookie

## Configuration Options

```typescript
cookies({
   httpOnly: true,           // Default: true
   secure: true,             // Default: true in production
   sameSite: 'Lax',          // 'Strict' | 'Lax' | 'None'
   path: '/',                // Cookie path
   domain: 'example.com',    // Cookie domain
   maxAge: 86400,            // Max age in seconds
   prefix: 'app_',           // Prefix for all cookie names
})
```

## Security Defaults

- `httpOnly` defaults to `true`.
- `secure` defaults to `true` in production.
- `sameSite` defaults to `Lax`.
- `path` defaults to `/`.
- Signed cookies must be written and verified with an application secret; do not
  reuse JWT secrets for unrelated cookie purposes.
- Set `secure: false` only for local HTTP development.

## Example: Using Both Together

```typescript
import { Cookie, Cookies, CookieService } from 'najm-cookies';

class SessionController {
   @Cookies({ prefix: 'sess_' }) 
   private cookies!: CookieService;

   @Post('/login')
   login() {
      // Use CookieService to SET cookies
      this.cookies.set('token', 'jwt-value');
      this.cookies.setJSON('user', { id: 1, role: 'admin' });
      return { success: true };
   }

   @Get('/me')
   getMe(
      @Cookie('sess_token') token: string,  // Quick read via param
   ) {
      // Use @Cookie for quick reads
      if (!token) return { error: 'Not authenticated' };
      return { token };
   }

   @Post('/logout')
   logout() {
      // Use CookieService to DELETE cookies
      this.cookies.delete('token');
      this.cookies.delete('user');
      return { success: true };
   }
}
```

## License
MIT
