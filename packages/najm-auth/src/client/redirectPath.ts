/** Normalize an untrusted navigation target to a path on the local origin. */
export function normalizeLocalRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;

  try {
    const base = new URL('https://najm.invalid');
    const parsed = new URL(value, base);
    // Removing dot segments can produce a pathname beginning with '//'. It
    // still belongs to base as a URL, but becomes off-site when returned as a
    // relative Location or passed to location.replace(). Check both forms.
    if (parsed.origin !== base.origin || parsed.pathname.startsWith('//')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
