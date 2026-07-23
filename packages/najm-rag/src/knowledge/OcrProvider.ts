export interface OcrProvider {
  readonly name: string;
  extract(filePath: string): Promise<string>;
}

export interface CaptionProvider {
  readonly name: string;
  caption(filePath: string): Promise<string>;
}

export class NoopOcrProvider implements OcrProvider {
  readonly name = 'noop';
  async extract(_filePath: string): Promise<string> {
    return '';
  }
}

export class NoopCaptionProvider implements CaptionProvider {
  readonly name = 'noop';
  async caption(_filePath: string): Promise<string> {
    return '';
  }
}
