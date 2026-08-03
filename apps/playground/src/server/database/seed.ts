import 'reflect-metadata';
import { hash } from 'bcryptjs';
import { Server } from 'najm-core';
import { SeedService } from 'najm-database';
import { authSeed } from 'najm-auth';

import { databaseConfig } from '../config/database';

const productRowsTemplate = [
  {
    id: '6c58366f-2f45-4f46-b6b9-6fba89ef6db7',
    ownerEmail: 'admin@admin.com',
    name: 'Laptop Pro 15',
    description: 'High-performance laptop with 15-inch display, 16GB RAM, 512GB SSD',
    price: 1299.99,
    stock: 25,
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
    isActive: true,
  },
  {
    id: 'db31fd8e-0614-4f38-8e6c-afc2a3afaa01',
    ownerEmail: 'admin@admin.com',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with precision tracking',
    price: 29.99,
    stock: 150,
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46',
    isActive: true,
  },
  {
    id: 'c93f5e40-8e65-4862-bce4-1a4ec18f90dd',
    ownerEmail: 'user@test.com',
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with Cherry MX switches',
    price: 149.99,
    stock: 50,
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae',
    isActive: true,
  },
  {
    id: '98f61dfb-5c52-47d7-a0f7-fd8ce5a89201',
    ownerEmail: 'admin@admin.com',
    name: 'USB-C Travel Hub',
    description: 'Compact USB-C hub with HDMI, Ethernet, SD reader, and fast charging passthrough',
    price: 59.99,
    stock: 40,
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1625842268584-8f3296236761',
    isActive: true,
  },
  {
    id: 'a87f4ae0-c5aa-4a77-94d6-47f5da9ec112',
    ownerEmail: 'admin@admin.com',
    name: 'USB-C Braided Cable',
    description: 'Durable two-meter braided USB-C cable for charging and data transfer',
    price: 14.99,
    stock: 120,
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef',
    isActive: true,
  },
  {
    id: 'be7bde6d-8d60-4977-b76a-1c0d5f99e331',
    ownerEmail: 'user@test.com',
    name: 'Gaming Mouse',
    description: 'Lightweight wired gaming mouse with adjustable DPI and programmable buttons',
    price: 49.99,
    stock: 35,
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7',
    isActive: true,
  },
  {
    id: 'd2d3e2f0-a4df-4a60-8c18-5d45dfc921ef',
    ownerEmail: 'user@test.com',
    name: 'Office Mouse Pad',
    description: 'Large non-slip desk mouse pad for office and home workstations',
    price: 12.5,
    stock: 85,
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3',
    isActive: true,
  },
  {
    id: '6b4667f7-df0d-43f1-92d6-238b9cb9a712',
    ownerEmail: 'admin@admin.com',
    name: 'Laptop Stand Pro',
    description: 'Adjustable aluminum laptop stand for ergonomic desk setups',
    price: 44.95,
    stock: 32,
    category: 'office',
    imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46',
    isActive: true,
  },
  {
    id: '33d4e76c-9c8f-4c7e-94f2-dbd1dc764c83',
    ownerEmail: 'admin@admin.com',
    name: 'Laptop Sleeve 15',
    description: 'Protective 15-inch laptop sleeve with soft lining and accessory pocket',
    price: 24.99,
    stock: 60,
    category: 'bags',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    isActive: true,
  },
  {
    id: '0b95df92-7b2c-4d65-aec4-00c54fdac002',
    ownerEmail: 'user@test.com',
    name: 'Noise Cancelling Headphones',
    description: 'Wireless over-ear headphones with active noise cancellation and long battery life',
    price: 199.99,
    stock: 18,
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    isActive: true,
  },
  {
    id: '77e7230d-d2c0-46f1-91df-65a678d2e724',
    ownerEmail: 'admin@admin.com',
    name: 'HD Webcam',
    description: '1080p webcam with autofocus and dual microphones for video calls',
    price: 69.99,
    stock: 27,
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04',
    isActive: true,
  },
  {
    id: '5abbd6bb-8958-4397-a18c-6ecf0bf6a025',
    ownerEmail: 'user@test.com',
    name: 'Portable SSD 1TB',
    description: 'Fast external solid-state drive with USB-C connectivity and rugged shell',
    price: 109.99,
    stock: 22,
    category: 'storage',
    imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b',
    isActive: true,
  },
  {
    id: 'e76b0392-0204-4d3e-bf62-ec65c8dcd04a',
    ownerEmail: 'admin@admin.com',
    name: 'Smart Desk Lamp',
    description: 'LED desk lamp with brightness controls, color modes, and USB charging',
    price: 39.99,
    stock: 45,
    category: 'office',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c',
    isActive: true,
  },
] as const;

const cartRowsTemplate = [
  {
    id: 'a0d11cf0-cd16-4d8e-a123-1f8f8999fd11',
    userEmail: 'user@test.com',
    productId: 'db31fd8e-0614-4f38-8e6c-afc2a3afaa01',
    quantity: 2,
  },
  {
    id: 'c2ed44e4-6b6f-4e20-a8c4-b3115f8a2c7b',
    userEmail: 'user@test.com',
    productId: 'c93f5e40-8e65-4862-bce4-1a4ec18f90dd',
    quantity: 1,
  },
  {
    id: 'f62f3281-12c4-4e0b-aa5d-c4206c8d31b4',
    userEmail: 'admin@admin.com',
    productId: '6c58366f-2f45-4f46-b6b9-6fba89ef6db7',
    quantity: 1,
  },
] as const;

const orderRowsTemplate = [
  {
    id: '1e9fdf0d-8828-4cef-8852-764170cf77db',
    userEmail: 'user@test.com',
    status: 'pending',
    items: [
      {
        id: '4c4e7ee9-91d2-4d53-8894-a9917384f2b3',
        productId: 'db31fd8e-0614-4f38-8e6c-afc2a3afaa01',
        quantity: 1,
      },
      {
        id: 'f6f3fa25-f02a-4717-a057-870f3c74ed36',
        productId: 'c93f5e40-8e65-4862-bce4-1a4ec18f90dd',
        quantity: 2,
      },
    ],
  },
  {
    id: '7a31616c-12ac-4c65-8bf4-fb84fe9453ba',
    userEmail: 'admin@admin.com',
    status: 'paid',
    items: [
      {
        id: '4d4f61eb-ac6f-47a1-a497-f5e6f42db56c',
        productId: '6c58366f-2f45-4f46-b6b9-6fba89ef6db7',
        quantity: 1,
      },
    ],
  },
] as const;

const authPermissionRows = [
  {
    action: 'create',
    resource: 'products',
    name: 'create:products',
    description: 'Permission to create products',
  },
  {
    action: 'read',
    resource: 'products',
    name: 'read:products',
    description: 'Permission to read products',
  },
  {
    action: 'update',
    resource: 'products',
    name: 'update:products',
    description: 'Permission to update products',
  },
  {
    action: 'delete',
    resource: 'products',
    name: 'delete:products',
    description: 'Permission to delete products',
  },
  {
    action: 'create',
    resource: 'cart',
    name: 'create:cart',
    description: 'Permission to add items to cart',
  },
  {
    action: 'read',
    resource: 'cart',
    name: 'read:cart',
    description: 'Permission to read cart',
  },
  {
    action: 'update',
    resource: 'cart',
    name: 'update:cart',
    description: 'Permission to update cart items',
  },
  {
    action: 'delete',
    resource: 'cart',
    name: 'delete:cart',
    description: 'Permission to remove cart items',
  },
  {
    action: 'create',
    resource: 'orders',
    name: 'create:orders',
    description: 'Permission to create orders',
  },
  {
    action: 'read',
    resource: 'orders',
    name: 'read:orders',
    description: 'Permission to read orders',
  },
  {
    action: 'update',
    resource: 'orders',
    name: 'update:orders',
    description: 'Permission to update order status',
  },
  {
    action: 'delete',
    resource: 'orders',
    name: 'delete:orders',
    description: 'Permission to delete orders',
  },
] as const;

const authUserRows = [
  {
    id: '4d6fbc01-2893-4f57-82f1-9482ddff7ddd',
    email: 'admin@admin.com',
    password: '12345678',
    roleId: 'role_admin',
    emailVerified: true,
    status: 'active',
    image: 'noavatar.png',
  },
  {
    id: 'a957bc77-8924-430d-8c17-f1a2cbf06ff5',
    email: 'user@test.com',
    password: 'User123!',
    roleId: 'role_user',
    emailVerified: true,
    status: 'active',
    image: 'noavatar.png',
  },
] as const;

const userRolePermissionNames = [
  'read:products',
  'create:cart',
  'read:cart',
  'update:cart',
  'delete:cart',
  'create:orders',
  'read:orders',
  'update:orders',
] as const;

const countInserted = (items: Array<{ table: string; count: number }>, tables: Set<string>): number =>
  items.filter((item) => tables.has(item.table)).reduce((total, item) => total + item.count, 0);

async function seed() {
  let server: Server | null = null;
  const seedActor = {
    id: authUserRows[0].id,
    role: 'admin',
  } as const;

  try {
    server = await new Server({ isolated: true })
      .use(databaseConfig())
      .base('/api')
      .log('🌱 Seeding playground database...')
      .init();

    const report = await server.runAs(seedActor, async () => {
      const seeder = await server!.container.resolve(SeedService);

      return await seeder.run(
        {
          ...authSeed({
            adminEmail: 'admin@admin.com',
            adminPass: '12345678',
            permissions: [...authPermissionRows],
            additionalUsers: [
              {
                email: 'user@test.com',
                password: 'User123!',
                roleName: 'user',
                emailVerified: true,
                status: 'active',
                image: 'noavatar.png',
              },
            ],
          }),
          rolePermissions: {
            by: ['roleId', 'permissionId'],
            rows: (seeded) => {
              const adminRole = seeded.roles.find((role: any) => role.name === 'admin');
              const userRole = seeded.roles.find((role: any) => role.name === 'user');

              if (!adminRole || !userRole) {
                throw new Error('Seeded roles not found. Expected admin and user roles');
              }

              const userPermissionSet = new Set(userRolePermissionNames);

              return seeded.permissions.flatMap((permission: any) => {
                const rows = [{ roleId: adminRole.id, permissionId: permission.id }];

                if (userPermissionSet.has(permission.name)) {
                  rows.push({ roleId: userRole.id, permissionId: permission.id });
                }

                return rows;
              });
            },
          },
          users: {
            by: ['email'],
            onConflict: 'replace',
            rows: async () =>
              Promise.all(
                authUserRows.map(async (row) => ({
                  id: row.id,
                  email: row.email,
                  password: await hash(row.password, 10),
                  roleId: row.roleId,
                  emailVerified: row.emailVerified,
                  status: row.status,
                  image: row.image,
                })),
              ),
          },
          products: {
            by: ['id'],
            onConflict: 'replace',
            rows: (seeded) => {
              const admin = seeded.users.find((user: any) => user.email === 'admin@admin.com');
              const regularUser = seeded.users.find((user: any) => user.email === 'user@test.com');

              if (!admin || !regularUser) {
                throw new Error('Seeded users not found. Expected admin@admin.com and user@test.com');
              }

              return productRowsTemplate.map((row) => ({
                id: row.id,
                userId: row.ownerEmail === 'admin@admin.com' ? admin.id : regularUser.id,
                name: row.name,
                description: row.description,
                price: row.price,
                stock: row.stock,
                category: row.category,
                imageUrl: row.imageUrl,
                isActive: row.isActive,
              }));
            },
          },
          orders: {
            by: ['id'],
            onConflict: 'replace',
            rows: (seeded) => {
              const usersByEmail = new Map<string, any>(
                seeded.users.map((user: any) => [user.email, user]),
              );
              const productsById = new Map<string, any>(
                seeded.products.map((product: any) => [product.id, product]),
              );

              return orderRowsTemplate.map((row) => {
                const user = usersByEmail.get(row.userEmail);
                if (!user) {
                  throw new Error(`Seeded user not found for order row: ${row.userEmail}`);
                }

                const total = row.items.reduce((sum, item) => {
                  const product = productsById.get(item.productId);
                  if (!product) {
                    throw new Error(`Seeded product not found for order row: ${item.productId}`);
                  }
                  return sum + Number(product.price) * item.quantity;
                }, 0);

                return {
                  id: row.id,
                  userId: user.id,
                  status: row.status,
                  total,
                };
              });
            },
          },
          orderItems: {
            by: ['id'],
            onConflict: 'replace',
            rows: (seeded) => {
              const orderIds = new Set<string>(seeded.orders.map((order: any) => order.id));
              const productsById = new Map<string, any>(
                seeded.products.map((product: any) => [product.id, product]),
              );

              return orderRowsTemplate.flatMap((row) => {
                if (!orderIds.has(row.id)) {
                  throw new Error(`Seeded order not found for order item rows: ${row.id}`);
                }

                return row.items.map((item) => {
                  const product = productsById.get(item.productId);
                  if (!product) {
                    throw new Error(`Seeded product not found for order item row: ${item.productId}`);
                  }

                  return {
                    id: item.id,
                    orderId: row.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: Number(product.price),
                  };
                });
              });
            },
          },
          cartItems: {
            by: ['id'],
            onConflict: 'replace',
            rows: (seeded) => {
              const usersByEmail = new Map<string, any>(
                seeded.users.map((user: any) => [user.email, user]),
              );

              return cartRowsTemplate.map((row) => {
                const user = usersByEmail.get(row.userEmail);
                if (!user) {
                  throw new Error(`Seeded user not found for cart row: ${row.userEmail}`);
                }

                return {
                  id: row.id,
                  userId: user.id,
                  productId: row.productId,
                  quantity: row.quantity,
                };
              });
            },
          },
        },
        {
          verbose: true,
          onConflict: 'skip',
          transaction: false,
        },
      );
    });

    const authTables = new Set(['roles', 'permissions', 'rolePermissions', 'users']);
    const rolesExpected = 2;
    const permissionsExpected = authPermissionRows.length;
    const rolePermissionsExpected = authPermissionRows.length + userRolePermissionNames.length;
    const usersExpected = 2;
    const authExpected = rolesExpected + permissionsExpected + rolePermissionsExpected + usersExpected;
    const productsExpected = productRowsTemplate.length;
    const ordersExpected = orderRowsTemplate.length;
    const orderItemsExpected = orderRowsTemplate.reduce((total, row) => total + row.items.length, 0);
    const cartItemsExpected = cartRowsTemplate.length;

    const authInserted = countInserted(report.items, authTables);
    const productsInserted = countInserted(report.items, new Set(['products']));
    const ordersInserted = countInserted(report.items, new Set(['orders']));
    const orderItemsInserted = countInserted(report.items, new Set(['orderItems']));
    const cartItemsInserted = countInserted(report.items, new Set(['cartItems']));

    server
      .log(`✅ Seed complete`)
      .log(`📊 Auth: ${authInserted} inserted, ${authExpected - authInserted} skipped`)
      .log(`📦 Products: ${productsInserted} inserted, ${productsExpected - productsInserted} skipped`)
      .log(`🧾 Orders: ${ordersInserted} inserted, ${ordersExpected - ordersInserted} skipped`)
      .log(`🧩 Order Items: ${orderItemsInserted} inserted, ${orderItemsExpected - orderItemsInserted} skipped`)
      .log(`🛒 Cart Items: ${cartItemsInserted} inserted, ${cartItemsExpected - cartItemsInserted} skipped`)
      .log('📝 Test users: admin@admin.com / 12345678 | user@test.com / User123!');
  } catch (error) {
    if (server) {
      server.log('❌ Seed failed', error);
    }
    throw error;
  } finally {
    if (server) {
      await server.stop();
    }
  }
}

await seed();
