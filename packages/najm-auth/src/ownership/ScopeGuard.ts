import 'reflect-metadata';
import { composeGuards } from 'najm-guard';
import { isAuth }        from '../auth/AuthGuard';
import { Can }           from '../permissions/PermissionGuards';
import { OwnershipToken } from './scopedOwnership';

// ── Metadata keys ──────────────────────────────────────────────────────────

const ACTION_KEY  = Symbol.for('najm:guard:action');
const TOKEN_KEY   = Symbol.for('najm:guard:token');
const POLICY_KEY  = Symbol.for('najm:policy:token');

// ── Permission map ─────────────────────────────────────────────────────────

const PERM: Record<string, (name: string) => string> = {
  list:   n => `read:${n}`,
  read:   n => `read:${n}`,
  create: n => `create:${n}`,
  update: n => `update:${n}`,
  delete: n => `delete:${n}`,
};

// ── Unified Can* decorator factory ─────────────────────────────────────────

type CanArg = string | OwnershipToken | undefined;

/**
 * Creates a unified CRUD decorator that works in two modes:
 *
 * **Standalone** — pass a permission string:
 * ```ts
 * @CanRead('posts')   // → isAuth + Can('read:posts')
 * ```
 *
 * **With @Policy** — pass nothing or an OwnershipToken override:
 * ```ts
 * @Policy(Product)
 * @Controller('/products')
 * class ProductController {
 *   @CanList()          // → reads resource from @Policy, applies read:products
 *   @CanRead(Review)    // → overrides with Review token
 * }
 * ```
 */
function createCanDecorator(action: string) {
  return (arg?: CanArg): MethodDecorator & ClassDecorator => {
    if (typeof arg === 'string') {
      // ── Standalone mode: direct permission string ──
      const permission = PERM[action]?.(arg) ?? `${action}:${arg}`;
      return Can(permission) as MethodDecorator & ClassDecorator;
    }

    // ── Policy mode: mark action, optionally override token ──
    return ((target: any, key?: string, desc?: PropertyDescriptor) => {
      if (key && desc) {
        // Method decorator
        Reflect.defineMetadata(ACTION_KEY, action, target, key);
        if (arg instanceof OwnershipToken) {
          Reflect.defineMetadata(TOKEN_KEY, arg, target, key);
        }
      }
    }) as MethodDecorator & ClassDecorator;
  };
}

// ── Exported Can* decorators ───────────────────────────────────────────────

/**
 * List action guard.
 * @example @CanList()           // with @Policy — reads resource from token
 * @example @CanList('posts')    // standalone — checks read:posts permission
 * @example @CanList(Review)     // with @Policy — overrides token for this method
 */
export const CanList   = createCanDecorator('list');
export const CanRead   = createCanDecorator('read');
export const CanCreate = createCanDecorator('create');
export const CanUpdate = createCanDecorator('update');
export const CanDelete = createCanDecorator('delete');

// ── @Policy class decorator ───────────────────────────────────────────────

/**
 * Class-level decorator that:
 * 1. Applies `isAuth()` to every route in the controller.
 * 2. For each method decorated with @CanList/@CanRead/@CanCreate/@CanUpdate/@CanDelete (no string arg),
 *    resolves the resource name from the token and applies `Can('action:resource')`.
 *
 * @example
 * ```ts
 * const Product = own(productsTable)
 *   .for('user', where(productsTable.userId));
 *
 * @Policy(Product)
 * @Controller('/products')
 * export class ProductController {
 *   @Get('/')        @CanList()   getAll()   { ... }
 *   @Get('/:id')     @CanRead()   getById()  { ... }
 *   @Post('/')       @CanCreate() create()   { ... }
 *   @Put('/:id')     @CanUpdate() update()   { ... }
 *   @Delete('/:id')  @CanDelete() delete()   { ... }
 * }
 * ```
 */
export function Policy(token: OwnershipToken) {
  return (target: Function) => {
    // Store the token for runtime introspection
    Reflect.defineMetadata(POLICY_KEY, token, target);

    // 1. Auth on all routes
    isAuth()(target as any);

    // 2. Permission guard per marked method
    // Note: class decorators run AFTER method decorators in TS,
    // so ACTION_KEY metadata is already set when this runs.
    const proto = target.prototype;

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const action: string | undefined = Reflect.getMetadata(ACTION_KEY, proto, key);
      if (!action) continue;

      const tok: OwnershipToken =
        Reflect.getMetadata(TOKEN_KEY, proto, key) ?? token;

      const permission = PERM[action]?.(tok.name);
      if (!permission) continue;

      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (!desc) continue;

      // Apply Can() permission guard to the method
      composeGuards(Can(permission))()(proto, key, desc);
      Object.defineProperty(proto, key, desc);
    }
  };
}

