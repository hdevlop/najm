'use client';

import { NNextImage } from 'najm-kit/next';

/**
 * The two delivery modes an application actually ships, rendered by a real
 * Next.js production build.
 *
 * A unit test can only assert what the component passes to `next/image`. This
 * asserts what Next then *does* with it: whether the emitted `src` goes through
 * `/_next/image` or straight to the route, which is the whole difference
 * between a public asset and one the browser must fetch itself.
 */
export default function MediaPage() {
  return (
    <main>
      <span data-media="optimized">
        <NNextImage src="/public-cover.png" alt="Public cover" width={64} height={64} />
      </span>

      <span data-media="direct" style={{ position: 'relative', display: 'block', height: 64, width: 64 }}>
        {/* A route the browser must reach directly. The application says so —
            the package never infers it from the URL. */}
        <NNextImage
          src="/api/managed/files/serve/fixture-asset"
          alt="Managed asset"
          fill
          sizes="64px"
          unoptimized
        />
      </span>

      <span data-media="eager">
        <NNextImage
          src="/public-cover.png"
          alt="Eager cover"
          width={32}
          height={32}
          loading="eager"
        />
      </span>
    </main>
  );
}
