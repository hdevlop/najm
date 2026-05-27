import { TextChunker, type ChunkResult } from './TextChunker';
import { MarkdownChunker } from './MarkdownChunker';
import type { ExtractedPdfText } from './PdfExtractor';

export type DocumentChunkResult = ChunkResult & { page?: number | null };

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

export function chunkDocument(
  text: string,
  sourceType: string,
  options?: ChunkOptions,
  pdf?: ExtractedPdfText,
): DocumentChunkResult[] {
  const chunkOptions = {
    targetTokens: options?.targetTokens,
    overlapTokens: options?.overlapTokens,
  };

  if (sourceType === 'pdf' && pdf?.pages?.length) {
    const chunker = new TextChunker(chunkOptions);
    const chunks: DocumentChunkResult[] = [];
    let ordinal = 0;

    for (const page of pdf.pages) {
      for (const chunk of chunker.chunk(page.text)) {
        chunks.push({ ...chunk, ordinal, page: page.page });
        ordinal++;
      }
    }

    return chunks;
  }

  if (sourceType === 'markdown') {
    const chunker = new MarkdownChunker(chunkOptions);
    return chunker.chunk(text);
  }

  const chunker = new TextChunker(chunkOptions);
  return chunker.chunk(text);
}
