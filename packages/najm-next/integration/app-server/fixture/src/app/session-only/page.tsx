import { kafilServer } from '../../server';

// Lightweight boundary: session only. Must not trigger appearance, branding,
// settings, cookie, or header loads.
export default async function SessionOnlyPage() {
  const session = await kafilServer.getSession();

  return <main>{`session-only:${session ? 'signed-in' : 'anonymous'}`}</main>;
}
