import { Server } from 'najm-core';
import { database, SeedService } from 'najm-database';
import { authSeed } from './seed';
import type { SeedAuthDataConfig, SeedAuthDataResult } from './seed.types';

/**
 * Standalone function to seed authentication data.
 * Handles Server setup, seeding, and cleanup automatically.
 *
 * @example
 * ```typescript
 * // In a seed script
 * import { seedAuthData } from 'najm-auth';
 * import { db } from './database';
 *
 * await seedAuthData({
 *   db,
 *   adminEmail: 'admin@app.com',
 *   adminPassword: 'Secret123!',
 *   users: [
 *     { email: 'user@app.com', password: 'User123!', roleName: 'user' }
 *   ]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // In a service method
 * @Service()
 * class SetupService {
 *   async seedDefaultData() {
 *     await seedAuthData({
 *       db: this.db,
 *       adminEmail: process.env.ADMIN_EMAIL!,
 *       adminPassword: process.env.ADMIN_PASSWORD!,
 *       verbose: true
 *     });
 *   }
 * }
 * ```
 */
export async function seedAuthData(
  config: SeedAuthDataConfig
): Promise<SeedAuthDataResult> {
  let server: Server | null = null;
  const seedActor = {
    id: '__seed_admin__',
    role: 'admin',
  } as const;

  try {
    // Create isolated server with database plugin
    server = new Server({ isolated: true }).use(database({ default: config.db }));

    // Initialize services without starting an HTTP listener
    await server.init();

    const report = await server.runAs(seedActor, async () => {
      const seeder = server!.container.get(SeedService);

      return await seeder.run(
        authSeed({
          adminEmail: config.adminEmail,
          adminPass: config.adminPassword,
          bcryptRounds: config.bcryptRounds,
          roles: config.roles,
          permissions: config.permissions,
          additionalUsers: config.users,
        }),
        {
          verbose: config.verbose ?? false,
          onConflict: config.onConflict ?? 'skip',
          transaction: false,  // Disable transaction for now to test
        }
      );
    });

    // Return seed result without querying back
    // (tables data can be queried directly if needed)
    return {
      inserted: report.inserted,
      skipped: report.skipped,
      failed: report.failed,
      users: [],  // Users can query db directly if needed
      roles: [],  // Users can query db directly if needed
    };
  } finally {
    // Always cleanup
    if (server) {
      await server.stop();
    }
  }
}
