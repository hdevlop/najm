// ============================================================================
// najm-theme/server — image sniffing
// ============================================================================
//
// What the bytes actually are, and how large the image inside them claims to
// be, read from the header alone.
//
// This runs before anything else touches an upload, and it runs whether or not
// Sharp is installed. That ordering is the point: `Content-Type` is a claim by
// the uploader, the file extension is a claim by the uploader, and a decoder
// handed a "PNG" that is really something else is the interesting attack. The
// declared type has to agree with the magic bytes before the file is stored, is
// served with a `Content-Type`, or reaches a native decoder.
//
// Dimensions come from the same header pass, which is what makes a
// decompression bomb — a 40 KB PNG that decodes to 30000×30000 — rejectable
// without allocating the 3.6 GB it wanted.
// ============================================================================

export type ProbedMimeType = "image/png" | "image/jpeg" | "image/webp";

export interface ProbedImage {
  mimeType: ProbedMimeType;
  width: number;
  height: number;
}

/** 8192² covers any logo or hero anybody has a reason to upload. */
export const MAX_IMAGE_DIMENSION = 8_192;
/** 40 megapixels — the decoded-size ceiling, independent of file size. */
export const MAX_IMAGE_PIXELS = 40_000_000;

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 24
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length > 16
    && bytes[0] === 0x52 // R
    && bytes[1] === 0x49 // I
    && bytes[2] === 0x46 // F
    && bytes[3] === 0x46 // F
    && bytes[8] === 0x57 // W
    && bytes[9] === 0x45 // E
    && bytes[10] === 0x42 // B
    && bytes[11] === 0x50 // P
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
    >>> 0
  );
}

/** The IHDR chunk is required to be first, so width and height are at fixed offsets. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return null;
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

/**
 * Walks the JPEG marker chain to the first Start-Of-Frame.
 *
 * Bounded by the segment lengths in the file itself, so a truncated or hostile
 * file runs out of buffer rather than out of patience. The `0xC4`/`0xC8`/`0xCC`
 * exclusions are Huffman tables and JPEG extensions, which share the SOF prefix
 * without being one.
 */
function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isStartOfFrame) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}

/** WebP has three container flavours and each stores its size differently. */
function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  const format = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (format === "VP8 " && bytes.length > 30) {
    return {
      width: ((bytes[26] | (bytes[27] << 8)) & 0x3fff) >>> 0,
      height: ((bytes[28] | (bytes[29] << 8)) & 0x3fff) >>> 0,
    };
  }

  if (format === "VP8L" && bytes.length > 25) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: ((bits & 0x3fff) >>> 0) + 1,
      height: (((bits >>> 14) & 0x3fff) >>> 0) + 1,
    };
  }

  if (format === "VP8X" && bytes.length > 30) {
    return {
      width: (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1,
      height: (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1,
    };
  }

  return null;
}

/**
 * Returns what the bytes are, or `null` when they are not one of the three
 * raster formats this package accepts.
 *
 * `null` and "unknown image format" are the same answer on purpose. Reporting
 * *which* non-image format was detected would turn this into a file-type oracle
 * for an endpoint whose only job is to accept logos.
 */
export function probeImage(bytes: Uint8Array): ProbedImage | null {
  if (isPng(bytes)) {
    const size = pngSize(bytes);
    return size ? { mimeType: "image/png", ...size } : null;
  }
  if (isJpeg(bytes)) {
    const size = jpegSize(bytes);
    return size ? { mimeType: "image/jpeg", ...size } : null;
  }
  if (isWebp(bytes)) {
    const size = webpSize(bytes);
    return size ? { mimeType: "image/webp", ...size } : null;
  }
  return null;
}

export const MIME_EXTENSIONS: Record<ProbedMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Normalizes what a browser may send for a JPEG.
 *
 * `image/jpg` is not a registered type but is what a surprising number of
 * clients put in `Content-Type`. Accepting it as an alias is not a security
 * decision — the magic bytes still decide — it just avoids rejecting a valid
 * upload over a spelling.
 */
export function normalizeDeclaredMime(value: string | undefined | null): string | null {
  if (!value) return null;
  const base = value.split(";")[0].trim().toLowerCase();
  if (base === "image/jpg") return "image/jpeg";
  return base || null;
}
