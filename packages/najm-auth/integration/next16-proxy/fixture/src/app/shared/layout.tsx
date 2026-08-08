import { serverAuth } from '../../session';

/**
 * `/shared` is deliberately absent from `protectedRoutes`, so the proxy never
 * touches it. Whatever session work happens on this route happens inside the
 * React render — which is what makes the recovery count a real measurement of
 * how many times one navigation resolves the session.
 */
export default async function SharedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await serverAuth.requireSession();

  return (
    <section data-layout-user={session.user.id}>
      <p>{`layout:${session.user.id}`}</p>
      {children}
    </section>
  );
}
