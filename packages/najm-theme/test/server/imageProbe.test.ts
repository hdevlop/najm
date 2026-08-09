import { describe, expect, it } from "bun:test";

import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  normalizeDeclaredMime,
  probeImage,
} from "../../src/server/branding/imageProbe";
import { onePixelPng } from "./harness";

/** A PNG header claiming any dimensions, with no pixel data behind it. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe("format detection", () => {
  it("reads a real PNG's format and size", () => {
    expect(probeImage(onePixelPng())).toEqual({ mimeType: "image/png", width: 1, height: 1 });
  });

  it("reads a JPEG's size from its first start-of-frame marker", () => {
    // SOI, an APP0 segment to skip over, then SOF0 with 40×30.
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e,
      0x00, 0x28, 0x03, 0x01, 0x11, 0x00,
    ]);
    expect(probeImage(bytes)).toEqual({ mimeType: "image/jpeg", width: 40, height: 30 });
  });

  it("reads a lossy WebP's size", () => {
    const bytes = new Uint8Array(32);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    bytes.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
    bytes[26] = 100;
    bytes[27] = 0;
    bytes[28] = 50;
    bytes[29] = 0;
    expect(probeImage(bytes)).toEqual({ mimeType: "image/webp", width: 100, height: 50 });
  });

  it("returns null for anything else, without naming what it found", () => {
    for (const bytes of [
      new TextEncoder().encode("<html><script>alert(1)</script></html>"),
      new TextEncoder().encode("GIF89a"),
      new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
      new Uint8Array(0),
    ]) {
      expect(probeImage(bytes)).toBeNull();
    }
  });

  it("returns null for a PNG signature with a truncated or wrong first chunk", () => {
    const bytes = pngHeader(1, 1);
    bytes.set([0x74, 0x45, 0x58, 0x74], 12); // tEXt instead of IHDR
    expect(probeImage(bytes)).toBeNull();
  });

  it("terminates on a JPEG whose marker chain never reaches a frame", () => {
    // A segment declaring a length of 2 (header only) repeated to the end.
    const bytes = new Uint8Array(64).fill(0);
    bytes.set([0xff, 0xd8], 0);
    for (let offset = 2; offset + 3 < bytes.length; offset += 4) {
      bytes.set([0xff, 0xe0, 0x00, 0x02], offset);
    }
    expect(probeImage(bytes)).toBeNull();
  });
});

describe("decompression bombs", () => {
  it("reports the claimed dimensions, so the caller can refuse before decoding", () => {
    const probed = probeImage(pngHeader(30_000, 30_000));
    expect(probed).toEqual({ mimeType: "image/png", width: 30_000, height: 30_000 });

    // The upload path's rule, stated here so the constants stay honest:
    // 30000×30000 is 900 megapixels — 22× the pixel ceiling, and each dimension
    // is already past the per-side one.
    expect(probed!.width).toBeGreaterThan(MAX_IMAGE_DIMENSION);
    expect(probed!.width * probed!.height).toBeGreaterThan(MAX_IMAGE_PIXELS);
  });

  it("still reports a wide-but-thin image that stays under the pixel ceiling", () => {
    const probed = probeImage(pngHeader(8_000, 100))!;
    expect(probed.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(probed.width * probed.height).toBeLessThan(MAX_IMAGE_PIXELS);
  });
});

describe("normalizeDeclaredMime", () => {
  it("strips parameters and lowercases", () => {
    expect(normalizeDeclaredMime("IMAGE/PNG; charset=binary")).toBe("image/png");
  });

  it("accepts image/jpg as the alias browsers actually send", () => {
    expect(normalizeDeclaredMime("image/jpg")).toBe("image/jpeg");
  });

  it("treats a missing or empty header as no claim at all", () => {
    expect(normalizeDeclaredMime(undefined)).toBeNull();
    expect(normalizeDeclaredMime("")).toBeNull();
    expect(normalizeDeclaredMime("   ")).toBeNull();
  });
});
