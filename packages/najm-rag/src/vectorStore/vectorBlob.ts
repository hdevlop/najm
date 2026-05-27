export function encodeF32(values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) buf.writeFloatLE(values[i], i * 4);
  return buf;
}

export function decodeF32(blob: Buffer | Uint8Array): number[] {
  const view = blob instanceof Buffer ? blob : Buffer.from(blob);
  const out = new Array<number>(view.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.readFloatLE(i * 4);
  return out;
}
