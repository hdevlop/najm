import { serverAuth } from '../../session';

export default async function SharedPage() {
  const session = await serverAuth.requireRole(['admin']);

  return <main>{`page:${session.user.id} shared navigation succeeded`}</main>;
}
