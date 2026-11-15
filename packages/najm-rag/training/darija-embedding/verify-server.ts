/**
 * Checks that a served model (Ollama or llama.cpp) returns the same vectors as
 * the trained model did in Colab, before routing with it.
 *
 *   bun verify-server.ts --model embeddinggemma-darija
 *   bun verify-server.ts --model embeddinggemma-darija --openai http://127.0.0.1:18080/v1
 *
 * Compares against apps/playground/bench/routing/.cache/embeddings-embeddinggemma-st-darija.json.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const model = arg('model', 'embeddinggemma-darija')!;
const openai = arg('openai');
const reference = arg('reference', join(resolve(import.meta.dir, '../../../..'), 'apps/playground/bench/routing/.cache/embeddings-embeddinggemma-st-darija.json'))!;

const expected: Record<string, number[]> = JSON.parse(readFileSync(reference, 'utf8'));
const texts = Object.keys(expected).filter((_t, i) => i % Math.max(1, Math.floor(Object.keys(expected).length / 40)) === 0).slice(0, 40);

async function embed(batch: string[]): Promise<number[][]> {
  if (openai) {
    const res = await fetch(`${openai.replace(/\/$/, '')}/embeddings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return ((await res.json()) as any).data.map((d: any) => d.embedding);
  }
  const base = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: batch }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return ((await res.json()) as any).embeddings;
}

const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / Math.sqrt(na * nb);
};

const got = await embed(texts);
const scores = texts.map((t, i) => cosine(got[i], expected[t]));
const min = Math.min(...scores);
const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
console.log(`${texts.length} texts, ${got[0].length} values: cosine to the Colab vectors min ${min.toFixed(4)}, mean ${mean.toFixed(4)}`);
if (got[0].length !== 768) console.log('not 768 values: najm-rag storage needs 768');
console.log(min >= 0.99 ? 'OK: the served model matches the trained model.'
  : 'MISMATCH: the served vectors differ (missing dense layers, pooling, or a lossy quantization). Do not route with it.');
process.exit(min >= 0.99 && got[0].length === 768 ? 0 : 1);
