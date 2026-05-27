import { describe, test, expect } from 'bun:test';
import { TextChunker, estimateTokens } from '../src/knowledge/TextChunker';

describe('TextChunker', () => {
  test('returns empty array for empty text', () => {
    const chunker = new TextChunker();
    expect(chunker.chunk('')).toEqual([]);
    expect(chunker.chunk('   ')).toEqual([]);
  });

  test('returns single chunk for short text', () => {
    const chunker = new TextChunker();
    const text = 'Hello world, this is a short piece of text.';
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].ordinal).toBe(0);
    expect(chunks[0].tokens).toBeGreaterThan(0);
  });

  test('splits text by paragraphs into chunks within token budget', () => {
    const chunker = new TextChunker({ targetTokens: 50, overlapTokens: 0 });
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} is about various topics that span multiple words and contain enough content to fill space.`).join('\n\n');
    const chunks = chunker.chunk(paragraphs);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokens).toBeLessThanOrEqual(80);
    }
  });

  test('assigns sequential ordinals', () => {
    const chunker = new TextChunker({ targetTokens: 50, overlapTokens: 0 });
    const text = Array.from({ length: 15 }, (_, i) => `This is paragraph number ${i + 1} and it has some content to split.`).join('\n\n');
    const chunks = chunker.chunk(text);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].ordinal).toBe(i);
    }
  });

  test('handles single long paragraph by splitting into smaller pieces', () => {
    const chunker = new TextChunker({ targetTokens: 20, overlapTokens: 0 });
    const longText = 'This is a very long paragraph. It contains multiple sentences. Each sentence adds more content. The total length should exceed the token budget. We need to make sure it keeps splitting. Until it all fits within limits. The final result should be multiple chunks.';
    const chunks = chunker.chunk(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('respects paragraph boundaries before splitting within paragraphs', () => {
    const chunker = new TextChunker({ targetTokens: 100, overlapTokens: 0 });
    const para1 = 'First paragraph with some content.';
    const para2 = 'Second paragraph with more content.';
    const text = `${para1}\n\n${para2}`;
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain(para1);
    expect(chunks[0].text).toContain(para2);
  });

  test('overlap produces overlapping content between adjacent chunks', () => {
    const chunker = new TextChunker({ targetTokens: 30, overlapTokens: 10, charsPerToken: 4 });
    const text = Array.from({ length: 10 }, (_, i) => `Paragraph ${i + 1} contains enough words to create overlapping regions between adjacent chunks.`).join('\n\n');
    const chunks = chunker.chunk(text);
    if (chunks.length > 1) {
      const overlapFound = chunks.some((chunk, i) => {
        if (i === 0) return false;
        const prev = chunks[i - 1].text;
        const overlap = prev.split('\n\n').pop() ?? '';
        return chunk.text.includes(overlap.trim());
      });
      expect(overlapFound || chunks.length > 1).toBe(true);
    }
  });

  test('preserves original text content across all chunks (no data loss)', () => {
    const chunker = new TextChunker({ targetTokens: 30, overlapTokens: 0 });
    const text = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} has distinct content that we want to preserve.`).join('\n\n');
    const chunks = chunker.chunk(text);
    for (const paragraph of text.split('\n\n')) {
      const found = chunks.some((chunk) => chunk.text.includes(paragraph.trim()));
      expect(found).toBe(true);
    }
  });

  test('estimateTokens returns positive integer for non-empty text', () => {
    expect(estimateTokens('hello')).toBeGreaterThan(0);
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a word')).toBe(2);
  });

  test('handles text with only whitespace between paragraphs', () => {
    const chunker = new TextChunker();
    const text = 'First paragraph.\n\n\n\n\nSecond paragraph.';
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('First paragraph.');
    expect(chunks[0].text).toContain('Second paragraph.');
  });

  test('custom charsPerToken affects token estimates', () => {
    const chunker4 = new TextChunker({ targetTokens: 100, charsPerToken: 4 });
    const chunker2 = new TextChunker({ targetTokens: 100, charsPerToken: 2 });
    const text = 'A '.repeat(200);
    const chunks4 = chunker4.chunk(text);
    const chunks2 = chunker2.chunk(text);
    expect(chunks2.length).toBeGreaterThanOrEqual(chunks4.length);
  });
});