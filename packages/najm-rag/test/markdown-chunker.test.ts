import { describe, test, expect } from 'bun:test';
import { MarkdownChunker } from '../src/knowledge/MarkdownChunker';

describe('MarkdownChunker', () => {
  test('returns empty array for empty markdown', () => {
    const chunker = new MarkdownChunker();
    expect(chunker.chunk('')).toEqual([]);
    expect(chunker.chunk('   ')).toEqual([]);
  });

  test('strips markdown headings when preserveHeadings is true (default)', () => {
    const chunker = new MarkdownChunker({ preserveHeadings: true });
    const md = '# Hello World\n\nSome paragraph text.';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('Hello World');
    expect(result).toContain('Some paragraph text.');
    expect(result).not.toContain('#');
  });

  test('removes markdown headings when preserveHeadings is false', () => {
    const chunker = new MarkdownChunker({ preserveHeadings: false });
    const md = '# Hello World\n\nSome paragraph text.';
    const result = chunker.stripMarkdown(md);
    expect(result).not.toContain('Hello World');
    expect(result).toContain('Some paragraph text.');
  });

  test('strips bold and italic markdown', () => {
    const chunker = new MarkdownChunker();
    const md = 'This is **bold** and *italic* and ***bold italic*** text.';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('bold');
    expect(result).toContain('italic');
    expect(result).toContain('bold italic');
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
  });

  test('strips links and images, keeping alt text', () => {
    const chunker = new MarkdownChunker();
    const md = 'Click [here](https://example.com) for more. ![An image](img.png)';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('here');
    expect(result).toContain('An image');
    expect(result).not.toContain('https://');
    expect(result).not.toContain('img.png');
  });

  test('strips code blocks keeping content', () => {
    const chunker = new MarkdownChunker();
    const md = 'Before\n```js\nconst x = 1;\n```\nAfter';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('const x = 1;');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  test('strips inline code', () => {
    const chunker = new MarkdownChunker();
    const md = 'Use the `console.log` function.';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('console.log');
    expect(result).not.toContain('`');
  });

  test('strips blockquotes', () => {
    const chunker = new MarkdownChunker();
    const md = '> This is a quote\n\nNormal text.';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('This is a quote');
    expect(result).not.toContain('>');
  });

  test('strips horizontal rules', () => {
    const chunker = new MarkdownChunker();
    const md = 'Before\n---\nAfter';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('Before');
    expect(result).toContain('After');
    expect(result).not.toContain('---');
  });

  test('strips HTML tags', () => {
    const chunker = new MarkdownChunker();
    const md = 'Text with <strong>bold</strong> and <br/> breaks.';
    const result = chunker.stripMarkdown(md);
    expect(result).toContain('bold');
    expect(result).not.toContain('<strong>');
    expect(result).not.toContain('<br/>');
  });

  test('chunks stripped markdown text via TextChunker', () => {
    const chunker = new MarkdownChunker({ targetTokens: 30, overlapTokens: 0 });
    const md = Array.from({ length: 20 }, (_, i) => `## Section ${i + 1}\n\nParagraph ${i + 1} with enough words to create multiple chunks when processed together.`).join('\n\n');
    const chunks = chunker.chunk(md);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.ordinal).toBeGreaterThanOrEqual(0);
      expect(chunk.tokens).toBeGreaterThan(0);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  test('chunk method returns plain text without markdown syntax', () => {
    const chunker = new MarkdownChunker();
    const md = '# Title\n\nThis has **bold** and *italic* text.';
    const chunks = chunker.chunk(md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).not.toContain('#');
    expect(chunks[0].text).not.toContain('**');
    expect(chunks[0].text).not.toContain('*');
  });
});