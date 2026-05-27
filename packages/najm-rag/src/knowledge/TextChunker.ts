export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
  charsPerToken?: number;
}

export interface ChunkResult {
  text: string;
  ordinal: number;
  tokens: number;
}

export class TextChunker {
  private readonly targetTokens: number;
  private readonly overlapTokens: number;
  private readonly charsPerToken: number;

  constructor(options?: ChunkOptions) {
    this.targetTokens = options?.targetTokens ?? 500;
    this.overlapTokens = options?.overlapTokens ?? 50;
    this.charsPerToken = options?.charsPerToken ?? 4;
  }

  chunk(text: string): ChunkResult[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const paragraphs = splitParagraphs(trimmed);
    if (paragraphs.length === 0) return [];

    const targetChars = this.targetTokens * this.charsPerToken;
    const overlapChars = this.overlapTokens * this.charsPerToken;

    const chunks: ChunkResult[] = [];
    let ordinal = 0;
    let i = 0;

    while (i < paragraphs.length) {
      const { combined, endIndex } = groupParagraphs(paragraphs, i, targetChars);

      const chunkText = combined.join('\n\n');
      const tokens = estimateTokens(chunkText, this.charsPerToken);

      chunks.push({
        text: chunkText,
        ordinal,
        tokens,
      });

      ordinal++;

      if (endIndex >= paragraphs.length) break;

      if (overlapChars > 0) {
        const overlapStart = findOverlapStart(paragraphs, endIndex, overlapChars);
        i = Math.max(overlapStart, i + 1);
      } else {
        i = endIndex;
      }
    }

    return chunks;
  }
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function groupParagraphs(
  paragraphs: string[],
  startIndex: number,
  targetChars: number,
): { combined: string[]; endIndex: number } {
  const combined: string[] = [];
  let charCount = 0;
  let i = startIndex;

  if (paragraphs[i].length > targetChars) {
    const subChunks = splitLongText(paragraphs[i], targetChars);
    combined.push(subChunks[0]);
    const remaining = subChunks.slice(1);
    if (remaining.length > 0) {
      paragraphs.splice(i + 1, 0, ...remaining);
    }
    return { combined, endIndex: i + 1 };
  }

  while (i < paragraphs.length) {
    const para = paragraphs[i];
    if (combined.length > 0 && charCount + para.length + 2 > targetChars) break;
    combined.push(para);
    charCount += para.length + 2;
    i++;
  }

  return { combined, endIndex: i };
}

function splitLongText(text: string, targetChars: number): string[] {
  const sentences = text
    .split(/(?<=[.!?。？！])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length > 1) {
    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (!current) {
        current = sentence;
      } else if (current.length + 1 + sentence.length <= targetChars) {
        current += ' ' + sentence;
      } else {
        chunks.push(current);
        current = sentence;
      }
    }
    if (current) chunks.push(current);
    if (chunks.length > 1) return chunks;
  }

  return splitByCharLimit(text, targetChars);
}

function splitByCharLimit(text: string, targetChars: number): string[] {
  if (text.length <= targetChars) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + Math.floor(targetChars * 0.5)) {
        end = lastSpace;
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
    if (start < text.length && text[start] === ' ') start++;
  }
  return chunks;
}

function findOverlapStart(paragraphs: string[], endIndex: number, overlapChars: number): number {
  let charCount = 0;
  let i = endIndex - 1;
  while (i >= 0 && charCount < overlapChars) {
    charCount += paragraphs[i].length + 2;
    i--;
  }
  return i + 1;
}

export function estimateTokens(text: string, charsPerToken: number = 4): number {
  return Math.ceil(text.length / charsPerToken);
}