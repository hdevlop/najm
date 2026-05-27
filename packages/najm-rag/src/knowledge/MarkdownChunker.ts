import { TextChunker, type ChunkResult, type ChunkOptions } from './TextChunker';

export interface MarkdownChunkOptions extends ChunkOptions {
  preserveHeadings?: boolean;
}

export class MarkdownChunker {
  private readonly textChunker: TextChunker;
  private readonly preserveHeadings: boolean;

  constructor(options?: MarkdownChunkOptions) {
    this.textChunker = new TextChunker(options);
    this.preserveHeadings = options?.preserveHeadings ?? true;
  }

  chunk(markdown: string): ChunkResult[] {
    const stripped = this.stripMarkdown(markdown);
    return this.textChunker.chunk(stripped);
  }

  stripMarkdown(markdown: string): string {
    let text = markdown;

    text = stripFencedCodeBlocks(text);
    text = stripInlineCode(text);
    text = stripImages(text);
    text = stripLinks(text);
    text = stripHeadings(text, this.preserveHeadings);
    text = stripBoldItalic(text);
    text = stripBlockquotes(text);
    text = stripHorizontalRules(text);
    text = stripHtmlTags(text);
    text = normalizeWhitespace(text);

    return text.trim();
  }
}

function stripFencedCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, match.length - 3);
    const firstNewline = code.indexOf('\n');
    const content = firstNewline >= 0 ? code.slice(firstNewline + 1) : code;
    return content.trim() || '';
  });
}

function stripInlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, '$1');
}

function stripImages(text: string): string {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function stripLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function stripHeadings(text: string, preserve: boolean): string {
  if (preserve) {
    return text.replace(/^(#{1,6})\s+(.+)$/gm, '$2');
  }
  return text.replace(/^#{1,6}\s+.+$/gm, '');
}

function stripBoldItalic(text: string): string {
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/___([^_]+)___/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  return text;
}

function stripBlockquotes(text: string): string {
  return text.replace(/^>\s?/gm, '');
}

function stripHorizontalRules(text: string): string {
  return text.replace(/^[-*_]{3,}\s*$/gm, '');
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +| +$/gm, '');
}