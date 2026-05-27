import { Service } from 'najm-core';
import pdfParse from 'pdf-parse';

export interface ExtractedPdfPage {
  page: number;
  text: string;
}

export interface ExtractedPdfText {
  text: string;
  pageCount: number;
  pages: ExtractedPdfPage[];
}

type PdfParser = (buffer: Buffer, options?: Record<string, unknown>) => Promise<any>;

let parserForTests: PdfParser | null = null;

export function setPdfParserForTests(parser?: PdfParser): void {
  parserForTests = parser ?? null;
}

@Service()
export class PdfExtractor {
  async extract(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<ExtractedPdfText> {
    const data = toBuffer(buffer);
    const pages: ExtractedPdfPage[] = [];

    const parser = parserForTests ?? (pdfParse as unknown as PdfParser);
    const result = await parser(data, {
      pagerender: async (pageData: any) => {
        const pageNumber = pages.length + 1;
        const content = await pageData.getTextContent();
        const text = content.items
          .map((item: any) => item?.str)
          .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
          .join(' ')
          .replace(/[ \t]+/g, ' ')
          .trim();

        pages.push({ page: pageNumber, text });
        return text;
      },
    });

    const text = normalizeExtractedText(result?.text ?? pages.map((p) => p.text).join('\n\n'));

    return {
      text,
      pageCount: Number(result?.numpages ?? result?.numPages ?? pages.length ?? 0),
      pages: pages.length > 0 ? pages : [{ page: 1, text }],
    };
  }
}

function toBuffer(buffer: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(buffer)) return buffer;
  if (buffer instanceof ArrayBuffer) return Buffer.from(buffer);
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
