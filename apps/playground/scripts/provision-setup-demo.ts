/**
 * Provision a demo account that must replace its temporary credential at first
 * login, the way an operator-created family account works.
 *
 * Run:  bun run demo:credential-setup
 *
 * Then, in the browser:
 *   1. /login with the printed email and CIN (try it uppercase)
 *   2. you land on /change-password — no dashboard, no session
 *   3. set a new password
 *   4. /login again with the new password
 */

import 'reflect-metadata';

import { AuthService, UserService } from 'najm-auth';
import { moroccanCinTemporaryCredential } from 'najm-auth/identity/ma';

// The real server, so provisioning runs against exactly the wiring the app has.
import { server } from '../src/server';

const DEMO = {
  email: 'provisioned@test.com',
  name: 'Provisioned Demo',
  phone: '0612345678',
  cin: 'AB123456',
  role: 'user',
} as const;

await server.init();

try {
  const users = await server.container.resolve(UserService);
  const auth = await server.container.resolve(AuthService);

  // Re-runnable: drop the previous demo account, requirement row included
  // (the FK cascades).
  const existing = await users.findByEmail(DEMO.email);
  if (existing) {
    await users.delete(existing.id);
    console.log(`Removed the previous ${DEMO.email}`);
  }

  const user = await auth.provisionUser({
    email: DEMO.email,
    name: DEMO.name,
    phone: DEMO.phone,
    role: DEMO.role,
    temporaryCredential: moroccanCinTemporaryCredential(DEMO.cin),
    requireCredentialSetup: 'password',
  });

  console.log('');
  console.log('Provisioned an account that owes a password setup:');
  console.log(`  id         ${user.id}`);
  console.log(`  email      ${DEMO.email}`);
  console.log(`  phone      ${(user as { phone?: string }).phone}  (normalized from ${DEMO.phone})`);
  console.log(`  temp CIN   ${DEMO.cin}  (stored lowercased; either case signs in)`);
  console.log('');
  console.log('Sign in at http://localhost:3000/login — you should land on /change-password.');
  console.log('');
} finally {
  await server.stop();
}
