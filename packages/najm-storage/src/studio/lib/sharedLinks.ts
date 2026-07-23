export interface SharedLink {
  id: string;
  url: string;
  namespace: string;
  filePath: string;
  createdAt: string;
  ttlSeconds: number;
}

const STORAGE_KEY = 'ss-shared-links';

export function getSharedLinks(): SharedLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SharedLink[]) : [];
  } catch {
    return [];
  }
}

export function addSharedLink(link: SharedLink): void {
  const links = getSharedLinks();
  links.unshift(link);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function removeSharedLink(id: string): void {
  const links = getSharedLinks().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function clearSharedLinks(): void {
  localStorage.removeItem(STORAGE_KEY);
}
