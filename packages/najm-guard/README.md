# najm-guard

Authorization guards plugin for Najm — class-based route protection with RBAC/PBAC support.

## Install

```bash
bun add najm-guard
```

## How It Works

`createGuard` takes a **guard class constructor** and returns a decorator factory. The guard class must have a `canActivate` method. Guards run before route handlers; return `true` to allow, throw to deny. Return a plain object to populate guard context:

```typescript
// Return { user: ... } to populate @User() in downstream handlers
return { user: verifiedUser };
```

## Usage

### Basic Guard

```typescript
import { Server } from 'najm-core';
import { Controller, Get, User } from 'najm-core';
import { createGuard } from 'najm-guard';
import { Headers } from 'najm-core';
import { Ctx } from 'najm-core';

// 1. Define the guard class
class AuthGuard {
  async canActivate(@Headers('authorization') auth: string, @Ctx() ctx: any) {
    if (!auth) throw new Error('Unauthorized');
    const user = await this.verifyToken(auth);
    return { user };
  }

  private async verifyToken(token: string) {
    return { id: '1', email: 'alice@example.com' };
  }
}

// 2. Create the decorator factory
export const IsAuth = createGuard(AuthGuard);

// 3. Apply to a controller
@Controller('/api')
class ApiController {
  @Get('/profile')
  @IsAuth()
  profile(@User() user: any) {
    return { user };
  }
}

await new Server()
  .load(ApiController)
  .listen(3000);
```

### Adding a Method-Level Guard

Class-level and method-level guards **compose** — both run, with class-level guards executing first. This lets you add extra checks to specific methods:

```typescript
import { createGuard } from 'najm-guard';

class AdminGuard {
  async canActivate(@Headers('authorization') auth: string) {
    const isAdmin = await this.checkAdmin(auth);
    if (!isAdmin) throw new Error('Forbidden');
    return true;
  }
}

export const IsAdmin = createGuard(AdminGuard);

@Controller('/api')
@IsAuth()                           // runs first for all methods
class ApiController {
  @Get('/profile')
  profile(@User() user: any) {     // only @IsAuth() runs
    return { user };
  }

  @Post('/admin-only')
  @IsAdmin()                        // @IsAuth() runs first, then @IsAdmin()
  adminRoute() {
    return { secret: true };
  }
}
```

### Composing Multiple Guards

Use `composeGuards` to combine multiple already-created decorator factories:

```typescript
import { createGuard, composeGuards } from 'najm-guard';

export const IsAuth = createGuard(AuthGuard);
export const IsAdmin = createGuard(AdminGuard);
export const IsModerator = createGuard(ModGuard);

// AND logic: all must pass
export const IsAdminOrMod = composeGuards(IsAuth(), IsAdmin());
export const FullAccess = composeGuards(IsAuth(), IsAdmin(), IsModerator());
```

## Guard Context Tokens

| Token | Purpose | Available via |
|-------|---------|---------------|
| `USER` | Authenticated user object | `@User()` |
| `OWNER` | Resource owner | `@Owner()` |
| `INFO` | Extra guard metadata | `@Info()` |
| `DATA` | Arbitrary guard-passed data | `@Data()` |
| `FILTER` | Query filter from guard | `@Filter()` |
| `ROLE` | Role from RBAC guard | `@Role()` |
| `PERMISSIONS` | Permissions array | `@Permissions()` |

## Guard Class Method Parameters

Guard `canActivate` methods use Najm parameter decorators for injection:

```typescript
class MyGuard {
  async canActivate(
    @Headers('authorization') auth: string,
    @Ctx() ctx: any,
    @Params('id') id: string,
  ) {
    // ...
    return true;
  }
}
```

## Production Notes

- Guards run **before** route handlers. Return `true` to allow, throw to deny.
- Return a plain object `{ user, role, ... }` from `canActivate` to populate context tokens
- Class-level and method-level guards **compose** — both run in sequence, not mutually exclusively
- `composeGuards` applies guards in order; all must pass for access to be granted
- For PBAC, combine with `najm-auth`'s `Can`, `canRead`, `canCreate`, etc.
- Guards that need to share data with downstream handlers should return the data via the result object, not via direct ALS manipulation