import { Service, Inject } from 'najm-core';
import { StorageService } from 'najm-storage';
import { RAG_OCR_PROVIDER } from '../tokens';
import type { OcrProvider } from './OcrProvider';
import { PdfExtractor, type ExtractedPdfText } from './PdfExtractor';
import type { DocumentSourceRow } from './DocumentSourceRepository';

@Service()
export class FileExtractor {
  @Inject() private storage?: StorageService;
  @Inject() private pdf?: PdfExtractor;
  @Inject(RAG_OCR_PROVIDER) private ocrProvider?: OcrProvider;

  async extract(source: DocumentSourceRow): Promise<{ text: string; pdf?: ExtractedPdfText }> {
    if (!this.storage) {
      throw new Error('Knowledge RAG file ingestion requires StorageService');
    }

    const data = await this.storage.get(source.namespace, source.originalPath);
    if (!data) {
      throw new Error(`Stored source file not found: ${source.originalPath}`);
    }

    if (source.sourceType === 'pdf') {
      if (!this.pdf) {
        throw new Error('PDF ingestion requires PdfExtractor');
      }
      const pdf = await this.pdf.extract(data);
      return { text: pdf.text, pdf };
    }

    if (source.sourceType === 'image') {
      if (!this.ocrProvider || this.ocrProvider.name === 'noop') {
        return { text: '' };
      }
      const text = await this.ocrProvider.extract(`${source.namespace}/${source.originalPath}`);
      return { text };
    }

    return { text: data.toString('utf8') };
  }
}
