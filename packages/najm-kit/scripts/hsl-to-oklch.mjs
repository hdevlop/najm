// One-off: convert najm-kit's HSL-triplet design tokens to oklch() strings.
// HSL triplet format is "H S% L%" (Tailwind v3 var style). Output matches the
// oklch(L C H) form Tailwind v4 / the SMS app uses.

function hslTripletToRgb(triplet) {
  const m = triplet.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`Bad HSL triplet: "${triplet}"`);
  let [, h, s, l] = m.map(Number);
  h = +h; s = +s / 100; l = +l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + mm, g + mm, b + mm];
}

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

function rgbToOklch([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

const round = (n, d) => Number(n.toFixed(d));

export function hslToOklch(triplet) {
  const [L, C, H] = rgbToOklch(hslTripletToRgb(triplet));
  const c = round(C, 4);
  // Achromatic: drop hue noise so grays read cleanly.
  if (c < 0.0005) return `oklch(${round(L, 4)} 0 0)`;
  return `oklch(${round(L, 4)} ${c} ${round(H, 3)})`;
}

// CLI: pass triplets as args, or run the built-in token batch.
if (process.argv[2]) {
  for (const t of process.argv.slice(2)) console.log(`${t}  ->  ${hslToOklch(t)}`);
}
