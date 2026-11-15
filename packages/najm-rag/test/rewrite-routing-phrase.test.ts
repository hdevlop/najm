import 'reflect-metadata';
import { describe, test, expect, mock } from 'bun:test';
import { phraseRoutingText } from '../src/toolRouter/ToolRouterUtils';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { SemanticImportJobService } from '../src/chatbotRag/SemanticImportJobService';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { ToolIndexRepository } from '../src/toolIndex/ToolIndexRepository';
import { rag } from '../src/plugin';

// A School-style message rewrite: hint lines that name tools, in front of the text.
const rewriteRoutingQuery = (text: string) => `tool hint: homework_get_by_student\n${text}`;
const rewriteRoutingPhrase = (text: string) => text.replace('wach', 'هل');

describe('rewriteRoutingPhrase: stored phrases need not carry the message rewrite', () => {
  test('without a phrase rewrite, phrases use the message rewrite (unchanged behaviour)', () => {
    expect(phraseRoutingText('wach kayn devoir', { rewriteRoutingQuery })).toBe('tool hint: homework_get_by_student\nwach kayn devoir');
  });

  test('with one, phrases use it instead', () => {
    expect(phraseRoutingText('wach kayn devoir', { rewriteRoutingQuery, rewriteRoutingPhrase })).toBe('هل kayn devoir');
  });

  test('rag() keeps the hook', () => {
    expect((rag({ dialect: 'sqlite', toolRouting: { enabled: true }, rewriteRoutingPhrase }) as any).config.rewriteRoutingPhrase).toBe(rewriteRoutingPhrase);
  });

  test('a phrase saved in the studio is embedded through the phrase rewrite', async () => {
    const embed = mock(async () => new Array(768).fill(0.1));
    const repository = { upsertSemantic: mock(async () => 'inserted'), findSemanticById: mock(async () => null), listSemantics: mock(async () => []) } as any;
    const cfg = { dialect: 'sqlite', toolRouting: { enabled: true }, rewriteRoutingQuery, rewriteRoutingPhrase } as any;
    const svc = new SemanticPhraseService(repository, { tools: [{ name: 'homework_get_by_student' }] } as any, { embed } as any,
      new ChatbotRagValidator(), { isIndexing: false } as any, cfg);
    await svc.createSemantic({ toolName: 'homework_get_by_student', phrase: 'wach kayn devoir', lang: 'darija' } as any).catch(() => {});
    expect((embed.mock.calls[0] as any[])[0]).toBe('هل kayn devoir');
  });

  test('an import job embeds through the phrase rewrite', async () => {
    const embedBatch = mock(async (texts: string[]) => texts.map(() => [0.1]));
    const repository = { findExistingSemantics: mock(async () => new Map()), upsertSemantic: mock(async () => 'inserted'), pruneDuplicateSemantics: mock(async () => 0) } as any;
    const job = new SemanticImportJobService(repository, { embedBatch } as any, { rewriteRoutingQuery, rewriteRoutingPhrase } as any);
    job.createImportJob([{ name: 'a.json', content: { homework_get_by_student: { darija: ['wach kayn devoir'] } } }]);
    for (let i = 0; i < 50 && embedBatch.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    expect((embedBatch.mock.calls[0] as any[])[0]).toEqual(['هل kayn devoir']);
  });

  test('setting the hook marks phrases stale; leaving it unset keeps existing vectors', () => {
    const fingerprint = (config: any) => Object.assign(new ToolIndexRepository(), { config }).semanticFingerprint;
    const base = { rag: { embedding: { model: 'm' } } };
    expect(fingerprint({ ...base, rewriteRoutingQuery })).toBe(fingerprint(base));
    expect(fingerprint({ ...base, rewriteRoutingQuery, rewriteRoutingPhrase })).not.toBe(fingerprint({ ...base, rewriteRoutingQuery }));
  });
});
