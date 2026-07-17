import { Context, MiddlewareHandler, Next } from 'hono';
import { LoggerService, ScannerService, Scan, ScanType, INJECTION_TYPES, Err } from 'najm-core';
import { Container, DI, Inject, Meta, Service } from 'najm-core';
import { CONTEXT, getRequestData, getRequestParser } from 'najm-core';  // ALS context + lazy request helpers
import type {
  ValidationConfig,
  ValidationPluginConfig,
  ValidationTarget,
  ErrorFormatter,
  ValidationSchema,
  ZodErrorLike,
} from './types';
import { VALIDATION_CONFIG, VALIDATED_BODY, VALIDATED_PARAMS, VALIDATED_QUERY, VALIDATED_HEADERS } from './tokens';
import { getValidationConfig } from './decorator';

@Service()
@Meta({ layer: 'plugin', order: 45 })
export class ValidationService {
  @DI() private container!: Container;
  @Scan() private scanner!: ScannerService;
  @Inject(VALIDATION_CONFIG) private config!: ValidationPluginConfig;
  @Inject(LoggerService) private log!: LoggerService;

  private validationCount = 0;
  private defaultErrorStatus = 400;
  private defaultStripUnknown = false;
  private defaultErrorFormatter?: ErrorFormatter;

  async scan(): Promise<void> {
    this.validationCount = 0;

    if (this.config?.enabled === false) {
      this.log.info('Validation plugin disabled');
      return;
    }

    this.scanner.scan(ScanType.CONTROLLER, {
      onMethod: (controller, methodName) => {
        const validationConfig = getValidationConfig(controller.prototype, methodName);

        if (validationConfig) {
          this.container.setInjection({
            type: INJECTION_TYPES.MIDDLEWARE,
            target: controller,
            methodName,
            handler: this.createValidationMiddleware(validationConfig),
            order: 45,
            source: 'validation',
          });

          this.validationCount++;
        }
      },
    });
  }

  async configure(): Promise<void> {
    if (this.config) {
      this.defaultErrorStatus = this.config.errorStatus ?? 400;
      this.defaultStripUnknown = this.config.stripUnknown ?? false;
      this.defaultErrorFormatter = this.config.errorFormatter;
    }
  }

  async activate(): Promise<void> {}

  async onReady(): Promise<void> {
    if (this.validationCount > 0) {
      this.log.info(`Validation: ${this.validationCount} route(s) configured`);
    }
  }

  /**
   * Create validation middleware for a specific route
   * Note: ctx param required by Hono but we use ALS internally
   */
  private createValidationMiddleware(config: ValidationConfig): MiddlewareHandler {
    return async (_ctx: Context, next: Next) => {
      const targets: ValidationTarget[] = ['body', 'params', 'query', 'headers'];

      for (const target of targets) {
        const schema = config[target];
        if (schema) {
          await this.validateTarget(target, schema, config);
        }
      }

      return next();
    };
  }

  /**
   * Validate a specific request target using ALS
   */
  private async validateTarget(
    target: ValidationTarget,
    schema: ValidationSchema,
    config: ValidationConfig
  ): Promise<void> {
    let data = await this.extractData(target);
    const shouldStrip = config.stripUnknown ?? this.defaultStripUnknown;

    // Strip File/Blob values from body before Zod validation.
    // Zod schemas use z.string().nullish() for image fields (required for MCP JSON Schema
    // compatibility). File objects would fail that check. We extract them here, let Zod
    // validate the rest, then restore files into the validated output.
    let extractedFiles: Record<string, unknown> = {};
    if (target === 'body' && data !== null && typeof data === 'object' && !Array.isArray(data)) {
      const result = this.extractFileFields(data as Record<string, unknown>);
      data = result.clean;
      extractedFiles = result.files;
    }

    try {
      const finalSchema = shouldStrip && typeof schema.strip === 'function'
        ? schema.strip()
        : schema;

      const validatedData = finalSchema.parse(data);

      // Restore extracted files into the validated body so services receive them via @Body()
      if (target === 'body' && Object.keys(extractedFiles).length > 0) {
        Object.assign(validatedData as Record<string, unknown>, extractedFiles);
      }

      const tokenMap = {
        body: VALIDATED_BODY,
        params: VALIDATED_PARAMS,
        query: VALIDATED_QUERY,
        headers: VALIDATED_HEADERS,
      };

      this.container.set(tokenMap[target], validatedData);
    } catch (error) {
      if (this.isZodErrorLike(error)) {
        this.throwValidationError(error, target, config);
      }
      throw error;
    }
  }

  /**
   * Separate File/Blob values from plain data so Zod validation is not given
   * binary objects it cannot handle. Only checks top-level keys.
   */
  private extractFileFields(data: Record<string, unknown>): {
    clean: Record<string, unknown>;
    files: Record<string, unknown>;
  } {
    const clean: Record<string, unknown> = {};
    const files: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (this.isFileValue(value)) {
        files[key] = value;
      } else {
        clean[key] = value;
      }
    }

    return { clean, files };
  }

  /**
   * Returns true for File, Blob, or arrays of File/Blob.
   * Duck-typed to work across realms (Next.js bundling, Bun, Node).
   */
  private isFileValue(value: unknown): boolean {
    if (value == null) return false;

    if (Array.isArray(value)) {
      return value.length > 0 && value.every(v => this.isFileValue(v));
    }

    if (typeof value === 'object') {
      const v = value as Record<string, unknown>;
      return typeof v['name'] === 'string' &&
             typeof v['size'] === 'number' &&
             typeof v['type'] === 'string' &&
             (typeof (v as any).arrayBuffer === 'function' ||
              typeof (v as any).stream === 'function');
    }

    return false;
  }

  private isZodErrorLike(error: unknown): error is ZodErrorLike {
    if (!error || typeof error !== 'object') return false;
    const issues = (error as { issues?: unknown }).issues;
    return Array.isArray(issues);
  }

  /**
   * Extract data from ALS instead of ctx
   */
  private async extractData(target: ValidationTarget): Promise<unknown> {
    // Request data/parser are built lazily per Context since the Tier 1
    // hot-path work (the ALS store only carries { requestId, context } now).
    const context = this.container.get(CONTEXT);

    switch (target) {
      case 'body':
        return getRequestParser(context).parseBody();

      case 'params':
        return context.req.param();

      case 'query':
        return getRequestData(context).query;

      case 'headers':
        return getRequestData(context).headers;

      default:
        return {};
    }
  }

  private throwValidationError(
    error: ZodErrorLike,
    target: ValidationTarget,
    config: ValidationConfig
  ) {
    const errorStatus = config.errorStatus ?? this.defaultErrorStatus;
    const formatter = config.errorFormatter ?? this.defaultErrorFormatter;

    if (formatter) {
      try {
        const customResponse = formatter(error, target);
        const customError = Err.createFromZod(error, target, errorStatus);
        (customError as any).toJSON = () => customResponse;
        throw customError;
      } catch (formatterError) {
        if (formatterError instanceof Error && formatterError.message.includes('Cannot read')) {
          Err.fromZod(error, target, errorStatus);
        }
        throw formatterError;
      }
    }

    Err.fromZod(error, target, errorStatus);
  }
}
