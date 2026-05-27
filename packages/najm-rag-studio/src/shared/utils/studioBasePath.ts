let explicitBasePath: string | null = null;

function normalize(path: string): string {
  if (!path) return '';
  const trimmed = path.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function setStudioBasePath(path: string | null | undefined): void {
  explicitBasePath = path == null ? null : normalize(path);
}

export function getStudioBasePath(): string | null {
  return explicitBasePath;
}
