# najm-cors

CORS (Cross-Origin Resource Sharing) plugin for Najm framework with support for global, controller-level, and route-level configuration.

## Installation

```bash
bun add najm-cors
```

## Quick Start

```typescript
import { Server } from 'najm-core';
import { cors } from 'najm-cors';

new Server()
  .use(cors({ origin: 'https://example.com' }))
  .load(YourController)
  .listen(3000);
```

## Usage

### Global CORS Configuration

Apply CORS settings globally to all routes:

```typescript
import { Server } from 'najm-core';
import { cors } from 'najm-cors';

new Server()
  .use(cors({
    origin: 'https://example.com',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  }))
  .load(Controller)
  .listen(3000);
```

### Default CORS

Enable CORS with default settings:

```typescript
new Server()
  .use(cors(true))
  .load(Controller)
  .listen(3000);
```

### Controller-Level CORS

Override global settings for an entire controller:

```typescript
import { Controller, Get } from 'najm-core';
import { Cors } from 'najm-core';

@Controller('/api')
@Cors({ origin: 'https://admin.example.com' })
export class AdminController {
  @Get('/users')
  getUsers() {
    return { users: [] };
  }
}
```

### Route-Level CORS

Override settings for specific routes:

```typescript
@Controller('/api')
@Cors({ origin: 'https://admin.example.com' })
export class AdminController {
  @Get('/public')
  @Cors({ origin: '*' })
  publicData() {
    return { data: 'public' };
  }

  @Post('/private')
  @Cors({ disabled: true })
  privateData() {
    return { data: 'private' };
  }
}
```

## Configuration Options

```typescript
interface CorsOptions {
  origin?: string | string[];           // Origin URL(s) allowed ('*' for any)
  allowMethods?: string[];              // Allowed HTTP methods
  allowHeaders?: string[];              // Allowed request headers
  exposeHeaders?: string[];             // Headers exposed to client
  maxAge?: number;                      // Preflight cache time in seconds
  credentials?: boolean;                // Allow credentials
  preflight?: boolean;                  // Handle preflight requests
}
```

## Default Configuration

```typescript
{
  origin: 'http://localhost:3000',
  allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflight: true
}
```

## Priority Resolution

CORS configuration is resolved in this order (highest to lowest priority):

1. **Route-level** `@Cors()` decorator (specific method)
2. **Controller-level** `@Cors()` decorator (all methods)
3. **Global** plugin configuration via `.use(cors(...))`
4. **Default** built-in configuration

## Examples

### Multiple Origins

```typescript
cors({
  origin: ['https://app1.com', 'https://app2.com'],
  credentials: true
})
```

### Wildcard with Custom Headers

```typescript
cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'X-Custom-Header'],
  exposeHeaders: ['X-Response-Header']
})
```

### Disable CORS for Public Routes

```typescript
@Controller('/public')
export class PublicController {
  @Get('/data')
  @Cors({ disabled: true })
  publicData() {
    return { data: 'public' };
  }
}
```

## Architecture

The CORS plugin:
1. Scans decorators on controllers and routes during the `scan` phase
2. Configures global CORS middleware during the `configure` phase
3. Registers route-specific CORS middleware during the `activate` phase
4. Integrates with RoutesService via the INJECTIONS token for route-level middleware

## Security Notes

- Using wildcard origin (`*`) with `credentials: true` is not recommended and will log a warning
- Always validate and restrict origins in production
- Be cautious with `allowHeaders` - only allow necessary headers

## License

MIT