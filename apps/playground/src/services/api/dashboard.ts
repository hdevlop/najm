import { cartService } from './cart';
import { healthService } from './health';
import { ordersService } from './orders';
import { productsService } from './products';
import type { ApiCartSummary, ApiHealthSummary, ApiOrder, ApiProduct, ApiUser, DashboardSnapshot } from './types';
import { AuthError } from 'najm-auth/client';
import { usersService } from './users';

const emptySummary: ApiHealthSummary = {
  app: 'najm-playground',
  now: new Date(0).toISOString(),
  totals: {
    products: 0,
    demoUserOrders: 0,
    demoUserCartItems: 0,
  },
};

const emptyCart: ApiCartSummary = {
  items: [],
  total: 0,
  quantity: 0,
};

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Array.isArray(permissions) && permissions.includes(permission);
}

async function withUnauthorizedFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AuthError && (error.status === 401 || error.status === 403)) {
      return fallback;
    }
    throw error;
  }
}

export async function getDashboardSnapshot(
  role?: string | null,
  permissions?: string[],
): Promise<DashboardSnapshot> {
  const isAdmin = role === 'admin';
  const capabilities = {
    products: isAdmin || hasPermission(permissions, 'read:products'),
    orders: isAdmin || hasPermission(permissions, 'read:orders'),
    cart: isAdmin || hasPermission(permissions, 'read:cart'),
    users: isAdmin,
  };

  const [summary, products, orders, cart, users] = await Promise.all([
    withUnauthorizedFallback(healthService.getSummary(), emptySummary),
    capabilities.products
      ? withUnauthorizedFallback<ApiProduct[]>(
          isAdmin ? productsService.listAll() : productsService.listMine(),
          [],
        )
      : Promise.resolve([]),
    capabilities.orders
      ? withUnauthorizedFallback<ApiOrder[]>(ordersService.listMine(), [])
      : Promise.resolve([]),
    capabilities.cart
      ? withUnauthorizedFallback<ApiCartSummary>(cartService.getMine(), emptyCart)
      : Promise.resolve(emptyCart),
    capabilities.users
      ? withUnauthorizedFallback<ApiUser[]>(usersService.listAll(), [])
      : Promise.resolve([]),
  ]);

  return {
    summary,
    products,
    orders,
    cart,
    users,
    capabilities,
  };
}
