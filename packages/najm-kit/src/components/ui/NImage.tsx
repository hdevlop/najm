import type { ImgHTMLAttributes } from "react";

import { normalizeImageSources } from "../../lib/imageSource";
import { useImageChain } from "../../hooks/useImageChain";

export interface NImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  /** Swapped in when `src` fails to load. */
  fallback?: string;
}

/**
 * Display-only image with error recovery. Deliberately a plain `<img>`: the
 * caller's CSS box owns the size, so there is nothing for a framework image
 * component to reserve or downscale. For a Next-managed image with the same
 * fallback behavior, use `NNextImage` from `najm-kit/next`.
 *
 * `onError` is forwarded rather than swallowed, and the transition runs first:
 * a caller that logs a broken asset still sees the event, and the fallback
 * still appears.
 */
export function NImage({ src, fallback, alt = "", onError, ...rest }: NImageProps) {
  // Shares the selection rules with NAvatar and NNextImage, which is what keeps
  // "the fallback is tried once and never retried" one behavior rather than
  // three implementations of it.
  const chain = useImageChain(normalizeImageSources([src, fallback]));

  return (
    <img
      {...rest}
      alt={alt}
      src={chain.src ?? src}
      onError={(event) => {
        chain.markFailed();
        onError?.(event);
      }}
    />
  );
}
