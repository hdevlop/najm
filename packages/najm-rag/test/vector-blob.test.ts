import { describe, test, expect } from 'bun:test';
import { encodeF32, decodeF32 } from '../src/vectorStore/vectorBlob';

describe('vectorBlob', () => {
  test('encodeF32 produces little-endian f32 buffer', () => {
    const values = [1.0, 2.0, 3.0];
    const buf = encodeF32(values);
    expect(buf.length).toBe(12);
    expect(buf.readFloatLE(0)).toBe(1.0);
    expect(buf.readFloatLE(4)).toBe(2.0);
    expect(buf.readFloatLE(8)).toBe(3.0);
  });

  test('decodeF32 round-trips random 768-dim vector', () => {
    const values = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
    const buf = encodeF32(values);
    const decoded = decodeF32(buf);
    expect(decoded.length).toBe(768);
    for (let i = 0; i < 768; i++) {
      expect(decoded[i]).toBeCloseTo(values[i], 6);
    }
  });

  test('decodeF32 accepts Uint8Array', () => {
    const values = [0.5, -0.5];
    const buf = encodeF32(values);
    const uint8 = new Uint8Array(buf);
    const decoded = decodeF32(uint8);
    expect(decoded).toEqual(values);
  });
});
