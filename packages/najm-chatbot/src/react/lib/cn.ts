export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function joinApiPath(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

export function inferMcpPath(apiPath: string): string {
  const normalized = apiPath.replace(/\/+$/, '');
  if (normalized.endsWith('/chat')) {
    return `${normalized.slice(0, -'/chat'.length) || ''}/mcp`;
  }
  return '/mcp';
}
