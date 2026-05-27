import { BaseError } from 'diject';


// ============================================================================
// VALIDATION ERROR CODES
// ============================================================================

export const VALIDATION_CODES = {
  BODY: 'VALIDATION_BODY',
  PARAMS: 'VALIDATION_PARAMS',
  QUERY: 'VALIDATION_QUERY',
  HEADERS: 'VALIDATION_HEADERS',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationIssue {
  path: PropertyKey[];
  message: string;
  code: string;
}

export interface ZodIssueLike {
  path: PropertyKey[];
  message: string;
  code: string;
}

export interface ZodErrorLike {
  issues: ZodIssueLike[];
}

// ============================================================================
// VALIDATION ERROR CLASS (internal)
// ============================================================================

class ValidationErrorImpl extends BaseError {
  constructor(
    public readonly target,
    public readonly issues: ValidationIssue[],
    code: string,
    status: number
  ) {
    super(code, `Validation failed for ${target}`, status);
    this.name = 'ValidationError';
  }

  override toJSON(): Record<string, any> {
    return {
      error: 'Validation Error',
      target: this.target,
      issues: this.issues,
    };
  }
}

// ============================================================================
// VALIDATION ERROR FACTORY
// ============================================================================

const getCode = (target): string =>
  VALIDATION_CODES[target.toUpperCase() as keyof typeof VALIDATION_CODES];

const parseZodIssues = (error: ZodErrorLike): ValidationIssue[] =>
  error.issues.map((issue: ZodIssueLike) => ({
    path: Array.isArray(issue.path) ? issue.path : [],
    message: typeof issue.message === 'string' ? issue.message : 'Invalid value',
    code: typeof issue.code === 'string' ? issue.code : 'invalid_type',
  }));

export const ValidationError = {
  // ========== TARGET-SPECIFIC ==========

  body: (issues: ValidationIssue[], status = 400): never => {
    throw new ValidationErrorImpl('body', issues, VALIDATION_CODES.BODY, status);
  },

  params: (issues: ValidationIssue[], status = 400): never => {
    throw new ValidationErrorImpl('params', issues, VALIDATION_CODES.PARAMS, status);
  },

  query: (issues: ValidationIssue[], status = 400): never => {
    throw new ValidationErrorImpl('query', issues, VALIDATION_CODES.QUERY, status);
  },

  headers: (issues: ValidationIssue[], status = 400): never => {
    throw new ValidationErrorImpl('headers', issues, VALIDATION_CODES.HEADERS, status);
  },

  create: (target, issues: ValidationIssue[], status = 400): ValidationErrorImpl => {
    return new ValidationErrorImpl(target, issues, getCode(target), status);
  },

  fromZod: (error: ZodErrorLike, target, status = 400): never => {
    throw new ValidationErrorImpl(target, parseZodIssues(error), getCode(target), status);
  },

  createFromZod: (error: ZodErrorLike, target, status = 400): ValidationErrorImpl => {
    return new ValidationErrorImpl(target, parseZodIssues(error), getCode(target), status);
  },

  // ========== TYPE GUARD ==========

  is: (error: unknown): error is ValidationErrorImpl => {
    return error instanceof ValidationErrorImpl;
  },
};
