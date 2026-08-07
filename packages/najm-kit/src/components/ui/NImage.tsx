import { useState, type ImgHTMLAttributes } from "react";

export interface NImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  src: string;
  /** Swapped in when `src` fails to load. */
  fallback?: string;
}

/**
 * Display-only image with error recovery. Deliberately a plain `<img>`: the
 * caller's CSS box owns the size, so there is nothing for a framework image
 * component to reserve or downscale.
 */
export function NImage({ src, fallback, alt = "", ...rest }: NImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const resolved = failed === src && fallback ? fallback : src;
  return <img {...rest} alt={alt} src={resolved} onError={() => setFailed(src)} />;
}
