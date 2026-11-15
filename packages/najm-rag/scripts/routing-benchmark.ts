/**
 * Routing benchmark: runs a routing test set through the real chat router
 * (`ToolRouterService` with the config `rag()` merges) against a live
 * embedding model, with an in-memory vector search that computes the same
 * cosine similarity as the stores.
 *
 *   bun packages/najm-rag/scripts/routing-benchmark.ts [--bench <dir>] [--phrases <file>] [--config <routing.json>]
 *     [--model <name>] [--json <out>] [--models] [--dr7 [--llm <ollama chat model>]]
 *
 * --models compares embedding models; --dr7 measures rewriteRoutingQueryOnMiss
 * with an Ollama chat model (default qwen2.5:1.5b). Results include how often
 * the first tool is a write tool the message did not ask for.
 *
 * Defaults measure the playground: apps/playground/bench/routing (tools.json,
 * cases.json), its semantics.json and routing.json. Embeddings come from
 * Ollama at OLLAMA_BASE_URL (default http://127.0.0.1:11434) and are cached
 * in <bench>/.cache. Not part of the published package.
 */
import 'reflect-metadata';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { RegisteredTool } from 'najm-mcp';
import { ToolRouterService } from '../src/toolRouter/ToolRouterService';
import { ToolRoutingLoader } from '../src/toolRouter/ToolRoutingLoader';
import { ToolRouterValidator } from '../src/toolRouter/ToolRouterValidator';
import { RoutingSettingsService } from '../src/routingSettings/RoutingSettingsService';
import { canonicalizeRoutingText, normalizeQuery } from '../src/toolRouter/ToolRouterUtils';
import { buildIndexText } from '../src/toolIndex/ToolIndexUtils';
import { createDarijaQueryRewriter } from '../src/queryRewrites/DarijaQueryRewriter';
import { rag } from '../src/plugin';
import type { RagConfig, RagMergedConfig } from '../src/config';

// ─── Inputs ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const ROOT = resolve(import.meta.dir, '../../..');
const BENCH = resolve(arg('bench', join(ROOT, 'apps/playground/bench/routing'))!);
const PHRASES = resolve(arg('phrases', join(ROOT, 'apps/playground/src/server/config/chatbot/semantics.json'))!);
const ROUTING_JSON = resolve(arg('config', join(ROOT, 'apps/playground/src/server/config/chatbot/routing.json'))!);
const MODEL = arg('model');
const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const JSON_OUT = arg('json');

interface ToolRow { name: string; group?: string; description: string; annotations?: Record<string, unknown> }
interface Phrase { toolName: string; lang: string; phrase: string }
interface Case { lang: string; query: string; expected: string[]; history?: string[]; tags?: string[] }

const tools: ToolRow[] = JSON.parse(readFileSync(join(BENCH, 'tools.json'), 'utf8'));
const allPhrases: Phrase[] = JSON.parse(readFileSync(PHRASES, 'utf8')).items
  .flatMap((item: any) => item.phrases.map((p: any) => ({ toolName: item.toolName, lang: p.lang ?? 'und', phrase: p.phrase })));
const CASES_FILE = resolve(BENCH, arg('cases', 'cases.json')!);
// `--split a|b`: even-numbered or odd-numbered cases, to tune on one half and confirm on the other.
const SPLIT = arg('split');
const cases: Case[] = (JSON.parse(readFileSync(CASES_FILE, 'utf8')).cases as Case[])
  .filter((_c, i) => !SPLIT || (SPLIT === 'a' ? i % 2 === 0 : i % 2 === 1));
const registered = tools.map((t) => ({ ...t, annotations: t.annotations ?? {} })) as unknown as RegisteredTool[];

// ─── Embeddings (cached by model and exact input) ──────────────────────────

const cache: Record<string, Record<string, number[]>> = {};
const cacheFile = (model: string) => join(BENCH, '.cache', `embeddings-${model.replace(/[^a-z0-9.-]/gi, '_')}.json`);
let fetched = 0;

/**
 * `DUMP_INPUTS=<file>`: record every text this run would embed (added to the
 * file) instead of calling the provider, for embedding them elsewhere with a
 * model Ollama does not serve. Scores from such a run are meaningless.
 * `--offline`: fail instead of calling the provider when a text is not cached.
 */
const DUMP_FILE = process.env.DUMP_INPUTS;
const dumped = new Set<string>(DUMP_FILE && existsSync(DUMP_FILE) ? JSON.parse(readFileSync(DUMP_FILE, 'utf8')) : []);
const OFFLINE = args.includes('--offline');
if (DUMP_FILE) process.on('exit', () => writeFileSync(DUMP_FILE, JSON.stringify([...dumped])));

async function embedInputs(model: string, inputs: string[]): Promise<number[][]> {
  if (DUMP_FILE) {
    inputs.forEach((t) => dumped.add(t));
    return inputs.map((_t, i) => Array.from({ length: 8 }, (_v, j) => Math.cos(i + j)));
  }
  const store = (cache[model] ??= existsSync(cacheFile(model)) ? JSON.parse(readFileSync(cacheFile(model), 'utf8')) : {});
  const missing = [...new Set(inputs)].filter((t) => !store[t]);
  if (OFFLINE && missing.length) {
    throw new Error(`${missing.length} texts are not in ${cacheFile(model)}, e.g. ${JSON.stringify(missing[0])}; dump the inputs again and re-embed`);
  }
  for (let i = 0; i < missing.length; i += 32) {
    const batch = missing.slice(i, i + 32);
    const res = await fetch(`${BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) throw new Error(`embedding failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { embeddings: number[][] };
    batch.forEach((t, j) => { store[t] = data.embeddings[j]; });
    fetched += batch.length;
  }
  if (missing.length) {
    mkdirSync(join(BENCH, '.cache'), { recursive: true });
    writeFileSync(cacheFile(model), JSON.stringify(store));
  }
  return inputs.map((t) => store[t]);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── One setup: the merged config, the indexed phrases and tools ───────────

interface Variant {
  name: string;
  /** Overrides on top of the playground's rag() config. */
  config?: Partial<RagConfig>;
  /** Phrases kept from the phrase file. */
  phrases?: (phrase: Phrase) => boolean;
  /** Run once before measuring, to fill the LLM cache. */
  warm?: boolean;
  exp?: Experiment;
}

interface Outcome {
  pass: boolean;
  primaryOk: boolean;
  tools: string[];
  status: string;
  /** The first tool is a write tool the message did not ask for (a confirm prompt at best). */
  wrongWrite: boolean;
  /** Routed on the second pass after rewriteRoutingQueryOnMiss. */
  rescued: boolean;
}

const isWrite = new Map(tools.map((t) => [t.name, (t.annotations as any)?.readOnlyHint !== true]));

// ─── DR7: an LLM rewrite for messages that matched nothing (`--dr7`) ───────

const LLM = arg('llm', 'qwen2.5:1.5b')!;
const LLM_PROMPT = 'You translate messages sent to an online shop assistant into short plain English. '
  + 'A message may be Moroccan Darija in Arabic script or in Latin script (Arabizi, where 3=ع, 7=ح, 9=ق, 2=ء), '
  + 'French, Arabic, or a mix. Reply with the English translation only, without quotes or explanation.';
const llmCacheFile = join(BENCH, '.cache', `llm-${LLM.replace(/[^a-z0-9.-]/gi, '_')}.json`);
const llmCache: Record<string, string> = existsSync(llmCacheFile) ? JSON.parse(readFileSync(llmCacheFile, 'utf8')) : {};
const llmLatencies: number[] = [];

/**
 * The hook an app would pass as `rewriteRoutingQueryOnMiss`. It ignores
 * `signal` and caches answers on disk, so a call the router timed out still
 * fills the cache; the variant is run twice and the second run is reported.
 */
async function llmRewrite(normalized: string): Promise<string | null> {
  if (llmCache[normalized] !== undefined) return llmCache[normalized];
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM, stream: false, keep_alive: '30m',
      options: { temperature: 0, num_predict: 48 },
      messages: [{ role: 'system', content: LLM_PROMPT }, { role: 'user', content: normalized }],
    }),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status}`);
  const text = ((await res.json()) as any).message?.content?.trim().replace(/^["'«]|["'»]$/g, '') ?? '';
  llmLatencies.push(performance.now() - start);
  llmCache[normalized] = text;
  mkdirSync(join(BENCH, '.cache'), { recursive: true });
  writeFileSync(llmCacheFile, JSON.stringify(llmCache));
  return text || null;
}

// ─── Darija experiments (`--darija`) ───────────────────────────────────────

// Everyday Darija words, the DR2 cleanup and the DR4 rules are in the
// package's createDarijaQueryRewriter. Measured gains are in RAG_CHATBOT_FIX_PLAN.md.

/**
 * Shop words an app adds itself through `words` (payments, French loans, shop
 * nouns). Some came from the held-out set, so their measured gain is inflated.
 */
const DARIJA_SHOP: Record<string, string> = {
  خلص: 'ادفع', نخلص: 'ادفع', شري: 'اشتر', نشري: 'اشتري', دوز: 'نفذ', الثمن: 'السعر', ثمن: 'سعر',
  البانيي: 'السله', بانيي: 'سله', الكوموند: 'الطلب', الكوموندات: 'الطلبات', كوموند: 'طلب', الكونط: 'الحساب', كونط: 'حساب',
  السلعه: 'المنتجات', سلعه: 'منتجات', المنتوج: 'المنتج', المنتوجات: 'المنتجات', منتوج: 'منتج', الطلبيه: 'الطلب', الطلبيات: 'الطلبات',
  الكاطالوك: 'الكتالوج', نكونيكطي: 'ادخل', ديكونيكطيني: 'اخرجني',
};

interface Experiment {
  /** EmbeddingGemma document prompt with the tool's description as title, for phrases. */
  phraseTitle?: boolean;
  /** Tool text: the package's index text, plain text, or title + description prompt. */
  toolText?: 'index' | 'plain' | 'title';
  /** Score the rewritten and the unrewritten message, best per tool. */
  expand?: boolean;
  /** App shop words on top of the package's Darija words. */
  words?: 'shop';
  /** Add <bench>/phrases-darija-extra.json to the phrases. */
  extraPhrases?: boolean;
  /** Multiplier on description scores. */
  descWeight?: number;
}

const humanize = (name: string) => name.replace(/_/g, ' ');

async function setup(v: Variant) {
  const exp = v.exp ?? {};
  const rewriter = createDarijaQueryRewriter(exp.words === 'shop' ? { words: DARIJA_SHOP } : {});
  const base: RagConfig = {
    dialect: 'sqlite',
    configPath: ROUTING_JSON,
    toolRouting: { enabled: true },
    rewriteRoutingQuery: rewriter,
    ...(MODEL ? { embedding: { model: MODEL } } : {}),
  };
  const overrides = v.config ?? {};
  const rawConfig: RagConfig = {
    ...base,
    ...overrides,
    embedding: { ...base.embedding, ...overrides.embedding },
    toolRouting: { ...base.toolRouting, ...overrides.toolRouting } as RagConfig['toolRouting'],
  };
  const config = (rag(rawConfig) as any).config as RagMergedConfig;
  const emb = config.rag.embedding as any;
  const model: string = emb.model;
  const prefix = (purpose: 'query' | 'document') => (purpose === 'query' ? emb.queryPrefix : emb.documentPrefix) ?? '';

  // Index as the package does: phrases through the routing pipeline, tools as index text.
  const extra: Phrase[] = exp.extraPhrases
    ? JSON.parse(readFileSync(join(BENCH, 'phrases-darija-extra.json'), 'utf8')).items
      .flatMap((item: any) => item.phrases.map((p: any) => ({ toolName: item.toolName, lang: p.lang, phrase: p.phrase })))
    : [];
  const phrases = [...allPhrases, ...extra].filter(v.phrases ?? (() => true));
  const describe = new Map(tools.map((t) => [t.name, t.description]));
  const canon = (text: string) => canonicalizeRoutingText(text, config.rewriteRoutingQuery);
  const phraseInputs = phrases.map((p) => (exp.phraseTitle
    ? `title: ${describe.get(p.toolName) ?? humanize(p.toolName)} | text: ${canon(p.phrase)}`
    : `${prefix('document')}${canon(p.phrase)}`));
  const toolInputs = tools.map((t) => {
    if (exp.toolText === 'plain') return `${prefix('document')}${t.description} (${humanize(t.name)})`;
    if (exp.toolText === 'title') return `title: ${humanize(t.name)} | text: ${t.description}`;
    return `${prefix('document')}${buildIndexText({
      name: t.name, description: t.description, group: t.group ?? null, localName: null, argNames: null, annotations: (t.annotations ?? {}) as any,
    })}`;
  });
  // truncateDimensions keeps the first `dimensions` values (Matryoshka); the
  // package also re-normalizes, which cosine similarity does not see.
  const dims: number = emb.dimensions ?? 768;
  const shape = (vecs: number[][]) => (emb.truncateDimensions ? vecs.map((v) => v.slice(0, dims)) : vecs);
  const embedShaped = async (inputs: string[]) => shape(await embedInputs(model, inputs));
  const [phraseVecs, toolVecs] = await Promise.all([embedShaped(phraseInputs), embedShaped(toolInputs)]);
  // A query vector may carry `alt`, the unrewritten message's vector (expand).
  const score = (e: any, vec: number[]) => Math.max(cosine(e, vec), e.alt ? cosine(e.alt, vec) : -1);
  const search = (rows: Array<{ toolName: string; vec: number[] }>, weight = 1) =>
    async (e: number[], limit: number, threshold: number) => rows
      .map((r) => ({ toolName: r.toolName, similarity: Math.min(1, score(e, r.vec) * weight) }))
      .filter((r) => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  const repository = {
    searchSemantics: search(phrases.map((p, i) => ({ toolName: p.toolName, vec: phraseVecs[i] }))),
    searchEmbeddings: search(tools.map((t, i) => ({ toolName: t.name, vec: toolVecs[i] })), exp.descWeight ?? 1),
  };
  // Rewritten routing text → the normalized message it came from.
  const original = new Map<string, string>();
  if (exp.expand) {
    for (const c of cases) {
      for (const text of [c.query, [...(c.history ?? []), c.query].slice(-3).join('\n---\n')]) {
        const normalized = normalizeQuery(text);
        const rewritten = canon(text);
        if (rewritten !== normalized) original.set(rewritten, normalized);
      }
    }
  }
  const withAlt = async (texts: string[]) => {
    const vecs = await embedShaped(texts.map((t) => `${prefix('query')}${t}`));
    return Promise.all(vecs.map(async (vec, i) => {
      const alt = original.get(texts[i]);
      if (!alt) return vec;
      const copy: any = [...vec];
      copy.alt = (await embedShaped([`${prefix('query')}${alt}`]))[0];
      return copy;
    }));
  };
  const embedding = {
    embed: async (text: string, purpose: 'query' | 'document' = 'query') => (purpose === 'query'
      ? (await withAlt([text]))[0]
      : (await embedShaped([`${prefix(purpose)}${text}`]))[0]),
    embedQueries: async (texts: string[]) => withAlt(texts),
  };

  // The real loader (routing.json over the merged config), with no stored studio settings.
  const log = { error() {}, warn() {} } as any;
  const loader = new ToolRoutingLoader(config, log, new ToolRouterValidator(),
    new RoutingSettingsService(config, { get: async () => null } as any));
  const run = async (threshold?: number): Promise<Outcome[]> => {
    const provider = {
      getRoutingConfig: async () => ({ ...(await loader.getRoutingConfig()), ...(threshold !== undefined ? { similarityThreshold: threshold } : {}) }),
    };
    const router = new ToolRouterService(
      config, { tools: registered } as any, embedding as any, repository as any, log, provider as any,
    );
    const out: Outcome[] = [];
    for (const c of cases) {
      const routingText = [...(c.history ?? []), c.query].slice(-3).join('\n---\n');
      const result = await router.findRelevantTools(routingText, { latestUserText: c.query });
      const names = result.tools.map((t) => t.name);
      const pass = c.expected.length === 0 ? names.length === 0 : c.expected.every((t) => names.includes(t));
      const primaryOk = c.expected.length === 0 ? names.length === 0 : names[0] === c.expected[0];
      const wrongWrite = names.length > 0 && !primaryOk && isWrite.get(names[0]) === true;
      out.push({ pass, primaryOk, tools: names, status: result.status, wrongWrite, rescued: result.rewrittenOnMiss === true });
    }
    return out;
  };
  /** The routed text and the three best tools with scores, for `--show --scores`. */
  const probe = async (query: string) => {
    const text = canon(query);
    const [vec] = await embedding.embedQueries([text]);
    const best = new Map<string, number>();
    for (const r of [...await repository.searchSemantics(vec, 1000, 0), ...await repository.searchEmbeddings(vec, 1000, 0)]) {
      best.set(r.toolName, Math.max(best.get(r.toolName) ?? -1, r.similarity));
    }
    const top = [...best].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, s]) => `${n} ${s.toFixed(2)}`).join(', ');
    return { text, top };
  };
  return { config, run, loader, probe };
}

// ─── Report ────────────────────────────────────────────────────────────────

const LANGS = ['en', 'fr', 'ar', 'darija', 'darija-latn', 'darija-fr'];
const TAGS = ['no-phrase', 'followup', 'tatweel', 'stretch', 'digits', 'gaf', 'negation', 'verb-prefix'];
const THRESHOLDS = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
const pct = (n: number, d: number) => (d === 0 ? '-' : `${Math.round((100 * n) / d)}%`);

function summarize(outcomes: Outcome[], keep: (i: number) => boolean = () => true) {
  const rows = cases.map((c, i) => ({ c, o: outcomes[i], i })).filter(({ i }) => keep(i));
  const pos = rows.filter(({ c }) => c.expected.length > 0);
  const neg = rows.filter(({ c }) => c.expected.length === 0);
  const group = (pick: (c: Case) => boolean) => {
    const g = pos.filter(({ c }) => pick(c));
    return { primary: g.filter(({ o }) => o.primaryOk).length, n: g.length };
  };
  return {
    pass: pos.filter(({ o }) => o.pass).length,
    primary: pos.filter(({ o }) => o.primaryOk).length,
    n: pos.length,
    falsePositives: neg.filter(({ o }) => !o.pass).length,
    negatives: neg.length,
    errors: rows.filter(({ o }) => o.status === 'router_error').length,
    wrongWrites: rows.filter(({ o }) => o.wrongWrite).length,
    rescued: rows.filter(({ o }) => o.rescued).length,
    rescuedRight: rows.filter(({ c, o }) => o.rescued && c.expected.length > 0 && o.primaryOk).length,
    byLang: Object.fromEntries(LANGS.map((l) => [l, group((c) => c.lang === l)])),
    byTag: Object.fromEntries(TAGS.map((t) => [t, group((c) => (c.tags ?? []).includes(t))])),
  };
}

const VARIANTS: Variant[] = [
  { name: 'playground (package defaults + Darija rewriter)' },
  { name: 'without the Darija rewriter', config: { rewriteRoutingQuery: undefined } },
  { name: 'without Arabizi phrases', phrases: (p) => p.lang !== 'darija-latn' },
  { name: 'without EmbeddingGemma prompts (0.45)', config: { embedding: { queryPrefix: '', documentPrefix: '' } } },
  { name: 'without prompts, threshold 0.5', config: { embedding: { queryPrefix: '', documentPrefix: '' }, toolRouting: { enabled: true, similarityThreshold: 0.5 } } },
];

/**
 * `--models`: other embedding models, each with the prompts its model card
 * gives, all at 768 values (storage is fixed at 768). Compare them by the
 * held-out line: their thresholds differ.
 */
const MODEL_VARIANTS: Variant[] = [
  { name: 'embeddinggemma (retrieval prompts)', config: { embedding: { model: 'embeddinggemma' } } },
  { name: 'qwen3-embedding:0.6b (instruction, cut to 768)', config: { embedding: {
    model: 'qwen3-embedding:0.6b', dimensions: 768, truncateDimensions: true,
    queryPrefix: 'Instruct: Given a user message, retrieve the tool or example request that handles it\nQuery:', documentPrefix: '',
  } } },
  { name: 'nomic-embed-text-v2-moe (search prefixes)', config: { embedding: {
    model: 'nomic-embed-text-v2-moe', queryPrefix: 'search_query: ', documentPrefix: 'search_document: ',
  } } },
  { name: 'granite-embedding:278m (no prompts)', config: { embedding: { model: 'granite-embedding:278m' } } },
];

/** `--dr7`: the playground setup with and without the LLM rewrite on a miss. */
const DR7_VARIANTS: Variant[] = [
  { name: 'playground, no rewrite on miss' },
  { name: `playground + ${LLM} translation on miss`, config: { rewriteRoutingQueryOnMiss: llmRewrite }, warm: true },
];

/** `--darija`: one change at a time against the current setup, then combinations. */
const DARIJA_VARIANTS: Variant[] = [
  { name: 'current' },
  { name: 'no Darija rewriter', config: { rewriteRoutingQuery: undefined } },
  { name: 'phrase title prompt', exp: { phraseTitle: true } },
  { name: 'tool text: plain', exp: { toolText: 'plain' } },
  { name: 'tool text: title prompt', exp: { toolText: 'title' } },
  { name: 'expand: rewritten + original', exp: { expand: true } },
  { name: 'app shop words', exp: { words: 'shop' } },
  { name: 'description weight 0.9', exp: { descWeight: 0.9 } },
  { name: 'description weight 1.1', exp: { descWeight: 1.1 } },
];

function darijaLine(name: string, outcomes: Outcome[]): string {
  const rows = cases.map((c, i) => ({ c, o: outcomes[i] }));
  const isDarija = (c: Case) => c.lang === 'darija' || c.lang === 'darija-fr';
  const pos = (pick: (c: Case) => boolean) => rows.filter(({ c }) => c.expected.length > 0 && pick(c));
  const right = (r: typeof rows) => `${r.filter(({ o }) => o.primaryOk).length}/${r.length}`;
  const darijaPos = pos(isDarija);
  const all = pos(() => true);
  const negDarija = rows.filter(({ c }) => c.expected.length === 0 && isDarija(c));
  const neg = rows.filter(({ c }) => c.expected.length === 0);
  return `${name.padEnd(34)} darija ${right(pos((c) => c.lang === 'darija')).padStart(6)}  darija-fr ${right(pos((c) => c.lang === 'darija-fr')).padStart(5)}`
    + `  (${pct(darijaPos.filter(({ o }) => o.primaryOk).length, darijaPos.length).padStart(4)}, given ${pct(darijaPos.filter(({ o }) => o.pass).length, darijaPos.length)})`
    + `  small talk ${negDarija.filter(({ o }) => !o.pass).length}/${negDarija.length}`
    + `  wrong write ${rows.filter(({ c, o }) => isDarija(c) && o.wrongWrite).length}`
    + ` | all ${pct(all.filter(({ o }) => o.primaryOk).length, all.length)}, FP ${neg.filter(({ o }) => !o.pass).length}`;
}

async function darijaMain() {
  console.log(`cases ${CASES_FILE}\n`);
  const combos: Variant[] = [];
  const picked = arg('combo');
  if (picked) combos.push({ name: `combo: ${picked}`, exp: JSON.parse(picked) });
  for (const v of picked ? combos : DARIJA_VARIANTS) {
    const { run, probe } = await setup(v);
    for (const t of args.includes('--sweep') ? [0.3, 0.35, 0.4] : [undefined]) {
      const outcomes = await run(t);
      console.log(darijaLine(`${v.name}${t !== undefined ? ` @${t}` : ''}`, outcomes));
      if (args.includes('--show')) {
        for (const [i, o] of outcomes.entries()) {
          const c = cases[i];
          if (o.primaryOk) continue;
          console.log(`    ${c.lang.padEnd(11)} ${JSON.stringify(c.query).padEnd(46)} want ${(c.expected[0] ?? 'none').padEnd(22)} got ${o.tools[0] ?? 'none'}`);
          if (args.includes('--scores')) {
            const { text, top } = await probe(c.query);
            console.log(`        → ${text}\n        top: ${top}`);
          }
        }
      }
    }
  }
  console.log(`\n${fetched} new embeddings fetched.`);
}

async function main() {
  if (args.includes('--darija')) return darijaMain();
  console.log(`${tools.length} tools, ${allPhrases.length} phrases, ${cases.length} cases (${cases.filter((c) => !c.expected.length).length} should get no tools)`);
  console.log(`phrases ${PHRASES}\nconfig  ${ROUTING_JSON}\n`);
  const results: any[] = [];
  const list = args.includes('--models') ? MODEL_VARIANTS : args.includes('--dr7') ? DR7_VARIANTS : VARIANTS;
  for (const v of list) {
    const { config, run, loader } = await setup(v);
    if (v.warm) await run();
    const outcomes = await run();
    const s = summarize(outcomes);
    const threshold = (await loader.getRoutingConfig()).similarityThreshold;
    console.log(`${v.name}  [${(config.rag.embedding as any).model}, threshold ${threshold}]`);
    console.log(`  right primary ${pct(s.primary, s.n)}, all expected included ${pct(s.pass, s.n)}, small talk given tools ${s.falsePositives}/${s.negatives}, wrong write tool first ${s.wrongWrites}${s.errors ? `, router errors ${s.errors}` : ''}`);
    if (config.rewriteRoutingQueryOnMiss) {
      const sorted = [...llmLatencies].sort((a, b) => a - b);
      const q = (p: number) => (sorted.length ? Math.round(sorted[Math.floor(p * (sorted.length - 1))]) : 0);
      console.log(`  rewrite on miss: ${s.rescued} routed on the second pass, ${s.rescuedRight} of them right; LLM ms p50 ${q(0.5)} p90 ${q(0.9)} max ${q(1)}, over 1500 ms ${sorted.filter((ms) => ms > 1500).length}/${sorted.length} (new calls this run)`);
    }
    console.log(`  by language: ${LANGS.map((l) => `${l} ${pct(s.byLang[l].primary, s.byLang[l].n)}`).join(', ')}`);
    console.log(`  by tag:      ${TAGS.map((t) => `${t} ${s.byTag[t].primary}/${s.byTag[t].n}`).join(', ')}`);

    const sweep: string[] = [];
    const byThreshold = new Map<number, Outcome[]>();
    for (const t of THRESHOLDS) {
      const o = await run(t);
      byThreshold.set(t, o);
      const st = summarize(o);
      sweep.push(`${t}: ${pct(st.primary, st.n)}/${st.falsePositives}`);
    }
    console.log(`  thresholds (right primary/small talk given tools): ${sweep.join('  ')}`);
    // Held-out: the threshold picked on even-numbered cases, scored on odd ones.
    let tuned = THRESHOLDS[0];
    let bestScore = -Infinity;
    for (const t of THRESHOLDS) {
      const h = summarize(byThreshold.get(t)!, (i) => i % 2 === 0);
      if (h.primary - h.falsePositives > bestScore) { bestScore = h.primary - h.falsePositives; tuned = t; }
    }
    const held = summarize(byThreshold.get(tuned)!, (i) => i % 2 === 1);
    console.log(`  held out: threshold ${tuned} picked on even cases → odd cases ${pct(held.primary, held.n)} right primary, ${held.falsePositives}/${held.negatives} small talk given tools\n`);
    const wrongWrites = outcomes.map((o, i) => ({ c: cases[i], o })).filter(({ o }) => o.wrongWrite);
    if (wrongWrites.length) console.log(`  wrong write tool first:\n${wrongWrites.map(({ c, o }) => `    "${c.query}" want ${c.expected[0] ?? 'none'}, got ${o.tools[0]}`).join('\n')}`);
    results.push({ variant: v.name, threshold, summary: s, outcomes: outcomes.map((o, i) => ({ ...cases[i], ...o, llm: llmCache[normalizeQuery(cases[i].query)] })) });
  }
  console.log(`${fetched} new embeddings fetched.`);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
}

await main();
