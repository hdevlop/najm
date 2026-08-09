import { loadServerAppearance } from '../serverTheme';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const appearance = await loadServerAppearance();
  return <main data-page={appearance.revision}>{`page:${appearance.revision}`}</main>;
}
