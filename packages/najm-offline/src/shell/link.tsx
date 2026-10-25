'use client';
/** Stands in for `next/link` in an offline shell build. */
import React, { forwardRef } from 'react';
import { useRouter } from 'najm-offline/shell/navigation';
type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string | { pathname?: string; query?: Record<string, string> }; prefetch?: boolean; replace?: boolean; scroll?: boolean };
export default forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _prefetch, replace, scroll: _scroll, onClick, ...props }, ref) {
  const router = useRouter();
  const path = typeof href === 'string' ? href : `${href.pathname ?? ''}${href.query ? '?' + new URLSearchParams(href.query) : ''}`;
  return <a {...props} ref={ref} href={path} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target || props.download) return;
    if (new URL(path, location.href).origin !== location.origin) return;
    event.preventDefault(); router[replace ? 'replace' : 'push'](path);
  }} />;
});
