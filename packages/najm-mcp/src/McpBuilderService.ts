import {
  Container,
  DI,
  Inject,
  LoggerService,
  Meta,
  ParamResolver,
  Service,
  getParameterMetadata,
  type ParameterMetadata,
} from 'najm-core';
import { McpServer as McpSdkServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  DATA,
  FILTER,
  getGuardMetadata,
  GUARD_PARAMS,
  INFO,
  OWNER,
  PERMISSIONS,
  ROLE,
  runGuards,
  USER,
} from 'najm-guard';
import { MCP_CONFIG } from './tokens';
import type {
  McpConfig,
  McpValidationSchema,
  RegisteredTool,
} from './types';
import { McpRegistryService } from './McpRegistryService';
import { McpException, McpErrorCode } from './exception';
import { getSchemaShape } from './schemaUtils';

export function resolveRegisteredToolInputSchema(tool: RegisteredTool): Record<string, unknown> | undefined {
  if (!tool.validation) {
    return undefined;
  }

  const paramsShape = getSchemaShape(tool.validation.params) ?? {};
  const queryShape = getSchemaShape(tool.validation.query) ?? {};
  const bodyShape = getSchemaShape(tool.validation.body) ?? {};
  const merged = { ...paramsShape, ...queryShape, ...bodyShape };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * The schema advertised to the SDK for a tool. Always a raw shape record
 * (ZodRawShape) — a single, consistent form across params-only / body-only /
 * query / merged cases. This is the shape both `registerTool()` and the legacy
 * `tool()` SDK signatures expect, and it avoids depending on a specific SDK
 * version normalizing ZodObject vs. raw-shape inputs (see review item #10).
 */
export function resolveRegisteredToolInputObjectSchema(tool: RegisteredTool): unknown {
  return resolveRegisteredToolInputSchema(tool);
}

@Service()
@Meta({ layer: 'plugin', order: 40 })
export class McpBuilderService {
  @DI() private container!: Container;
  @Inject(MCP_CONFIG) private config!: McpConfig;
  @Inject() private registry!: McpRegistryService;
  @Inject(LoggerService) private log!: LoggerService;

  public mcpServer!: McpSdkServer;
  private isBuilt = false;
  private resolver?: ParamResolver;
  private readonly parameterNamesCache = new WeakMap<Function, string[]>();

  async configure(): Promise<void> {
    this.resolver = new ParamResolver(this.container);
    await this.ensureBuilt();
  }

  async ensureBuilt(): Promise<void> {
    if (this.isBuilt) return;

    this.mcpServer = this.createServer();
    this.isBuilt = true;
  }

  createServer(): McpSdkServer {
    const mcpServer = new McpSdkServer({
      name: this.config.name,
      version: this.config.version,
    });

    this.registerTools(mcpServer, this.registry.tools);

    return mcpServer;
  }

  private registerTools(mcpServer: McpSdkServer, tools: RegisteredTool[]): void {
    for (const tool of tools) {
      const inputSchema = resolveRegisteredToolInputObjectSchema(tool);

      const invoke = async (params?: Record<string, any>) => {
        return this.invokeTool(tool.name, params);
      };

      this.registerTool(mcpServer, tool, inputSchema, invoke);
    }
  }

  // ALS invariant: callers must invoke this inside the desired request scope; invokeTool does NOT create a new ALS scope so @User/@Policy/guards resolve from the caller's context.
  async invokeTool(name: string, params?: Record<string, any>): Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }> {
    const tool = this.registry.tools.find(t => t.name === name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const timeout = this.config.toolTimeout ?? 30_000;

      return await this.withTimeout(async () => {
        let input = params ?? {};

        if (tool.validation) {
          input = this.validateInput(tool, input);
        }

        await this.executeClassGuards(tool.target, tool.methodKey);

        const instance = await this.container.resolve(tool.target);
        const method = instance[tool.methodKey as any] as Function;
        const orderedArgs = this.resolveControllerArgs(tool, method, input);
        const result = await method.call(instance, ...orderedArgs);

        return this.toToolResult(result);
      }, timeout);
    } catch (error) {
      this.log.error?.(`MCP tool failed: ${tool.name}`, error);

      if (tool.catchErrors && !(error instanceof McpException)) {
        const detail = this.errorMessage(error);
        return {
          content: [{ type: 'text' as const, text: `${tool.catchErrors}: ${detail}` }],
          isError: true,
        };
      }

      return this.buildErrorResult(error);
    }
  }

  private async executeClassGuards(target: any, methodKey: string | symbol): Promise<void> {
    const classGuards = getGuardMetadata(target) ?? [];
    const methodGuards = getGuardMetadata(target, String(methodKey)) ?? [];
    const guards = [...classGuards, ...methodGuards];

    if (guards.length === 0) return;

    // Fail closed: a tool carries guard metadata but the resolver was never
    // initialized (e.g. invokeTool reached without configure() running). We
    // must not execute a guarded tool with its guards silently skipped.
    if (!this.resolver) {
      throw new McpException(
        `Cannot evaluate guards for tool: ${target.name}.${String(methodKey)} — guard resolver not initialized`,
        McpErrorCode.FORBIDDEN,
      );
    }

    const allowed = await runGuards(guards, this.container, this.resolver);
    if (!allowed) {
      throw new McpException(
        `Access denied for tool: ${target.name}.${String(methodKey)}`,
        McpErrorCode.FORBIDDEN,
      );
    }
  }

  private registerTool(
    mcpServer: McpSdkServer,
    tool: RegisteredTool,
    inputSchema: unknown,
    invoke: (params?: Record<string, any>) => Promise<any>,
  ): void {
    const hasInputSchema = inputSchema !== undefined;
    const annotations = tool.annotations;
    const registerTool = (mcpServer as any).registerTool;

    if (typeof registerTool === 'function') {
      const config: Record<string, unknown> = {
        description: tool.description,
      };

      if (hasInputSchema) {
        config.inputSchema = inputSchema;
      }

      if (annotations) {
        config.annotations = annotations;
      }

      registerTool.call(
        mcpServer,
        tool.name,
        config,
        async (params: Record<string, any> | undefined) => invoke(params ?? {}),
      );
      return;
    }

    if (!hasInputSchema) {
      if (annotations) {
        (mcpServer as any).tool(tool.name, tool.description, annotations, async () => invoke());
      } else {
        mcpServer.tool(tool.name, tool.description, async () => invoke());
      }
      return;
    }

    if (annotations) {
      (mcpServer as any).tool(
        tool.name,
        tool.description,
        inputSchema,
        annotations,
        async (params: Record<string, any> | undefined) => invoke(params ?? {}),
      );
    } else {
      (mcpServer as any).tool(
        tool.name,
        tool.description,
        inputSchema,
        async (params: Record<string, any> | undefined) => invoke(params ?? {}),
      );
    }
  }

  private resolveControllerArgs(tool: RegisteredTool, method: Function, params: Record<string, any>): any[] {
    const metadata = (getParameterMetadata(method) ?? []) as ParameterMetadata[];
    const { paramValues, queryValues, bodyValue, paramKeys, queryKeys } = this.splitControllerInput(tool, metadata, params);
    const argCount = Math.max(
      method.length,
      metadata.reduce((max, meta) => Math.max(max, meta.index + 1), 0),
    );

    if (argCount === 0) {
      return [];
    }

    const args = new Array(argCount).fill(undefined);
    const decoratedIndices = new Set<number>();

    for (const meta of metadata) {
      args[meta.index] = this.resolveControllerParameter(meta, paramValues, queryValues, bodyValue);
      decoratedIndices.add(meta.index);
    }

    if (decoratedIndices.size < argCount) {
      const names = this.getParameterNames(method);

      for (let i = 0; i < argCount; i++) {
        if (decoratedIndices.has(i)) continue;

        const name = names[i];
        if (name && paramKeys.has(name)) {
          args[i] = paramValues[name];
        } else if (name && queryKeys.has(name)) {
          args[i] = queryValues[name];
        } else {
          args[i] = bodyValue;
        }
      }
    }

    return args;
  }

  private splitControllerInput(
    tool: RegisteredTool,
    metadata: ParameterMetadata[],
    params: Record<string, any>,
  ): {
    paramValues: Record<string, any>;
    queryValues: Record<string, any>;
    bodyValue: any;
    paramKeys: Set<string>;
    queryKeys: Set<string>;
  } {
    const paramKeys = new Set(tool.validationParamKeys ?? []);
    const queryKeys = new Set(tool.validationQueryKeys ?? []);
    const hasParamsObject = metadata.some((meta) => meta.type === 'params' && !meta.propertyKey);
    const hasQueryObject = metadata.some((meta) => (meta.type === 'query' || meta.type === 'queries') && !meta.propertyKey);
    const hasBodyDecorator = metadata.some((meta) => this.isBodyType(meta.type));

    for (const meta of metadata) {
      if (meta.type === 'params' && meta.propertyKey) {
        paramKeys.add(meta.propertyKey);
      }
      if (meta.type === 'query' && meta.propertyKey) {
        queryKeys.add(meta.propertyKey);
      }
    }

    const paramValues: Record<string, any> = {};
    const queryValues: Record<string, any> = {};
    const bodyValues: Record<string, any> = {};

    // Whole-object @Params() with no explicit param/query schema and no body or
    // query decorator: treat the entire input as route params (legacy behavior).
    if (hasParamsObject && paramKeys.size === 0 && queryKeys.size === 0 && !hasBodyDecorator && !hasQueryObject) {
      return {
        paramValues: { ...params },
        queryValues,
        bodyValue: undefined,
        paramKeys,
        queryKeys,
      };
    }

    for (const [key, value] of Object.entries(params)) {
      if (paramKeys.has(key)) {
        paramValues[key] = value;
      } else if (queryKeys.has(key)) {
        queryValues[key] = value;
      } else {
        bodyValues[key] = value;
      }
    }

    return {
      paramValues,
      queryValues,
      bodyValue: Object.keys(bodyValues).length > 0 ? bodyValues : undefined,
      paramKeys,
      queryKeys,
    };
  }

  private resolveControllerParameter(
    meta: ParameterMetadata,
    paramValues: Record<string, any>,
    queryValues: Record<string, any>,
    bodyValue: any,
  ): any {
    const { type, propertyKey } = meta;

    switch (type) {
      case 'body':
      case 'json':
      case 'text':
      case 'formData':
      case 'arrayBuffer':
      case 'blob':
        return propertyKey ? bodyValue?.[propertyKey] : bodyValue;

      case 'params':
        return propertyKey ? paramValues?.[propertyKey] : paramValues;

      case 'query':
        return propertyKey ? queryValues?.[propertyKey] : queryValues;
      case 'queries':
        return queryValues;

      case 'user':
        return this.getAlsValue(USER, propertyKey);
      case 'owner':
        return this.getAlsValue(OWNER, propertyKey);
      case 'info':
        return this.getAlsValue(INFO, propertyKey);
      case 'data':
        return this.getAlsValue(DATA, propertyKey);
      case 'filter':
        return this.getAlsValue(FILTER, propertyKey);
      case 'guardParams':
        return this.getAlsValue(GUARD_PARAMS, propertyKey);
      case 'role':
        return this.getAlsValue(ROLE, propertyKey);
      case 'permissions':
        return this.getAlsValue(PERMISSIONS, propertyKey);

      default:
        return undefined;
    }
  }

  private getAlsValue(token: any, propertyKey?: string): any {
    const value = this.container.get(token);
    return propertyKey && value && typeof value === 'object' ? value[propertyKey] : value;
  }

  private isBodyType(type: ParameterMetadata['type']): boolean {
    return type === 'body'
      || type === 'json'
      || type === 'text'
      || type === 'formData'
      || type === 'arrayBuffer'
      || type === 'blob';
  }

  private validateInput(tool: RegisteredTool, params: Record<string, any>): Record<string, any> {
    const paramKeys = new Set(tool.validationParamKeys ?? []);
    const queryKeys = new Set(tool.validationQueryKeys ?? []);
    const paramData: Record<string, any> = {};
    const queryData: Record<string, any> = {};
    const bodyData: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (paramKeys.has(key)) {
        paramData[key] = value;
      } else if (queryKeys.has(key)) {
        queryData[key] = value;
      } else {
        bodyData[key] = value;
      }
    }

    const validatedParams = this.parseSchema(tool.validation?.params, paramData, tool.validation?.stripUnknown);
    const validatedQuery = this.parseSchema(tool.validation?.query, queryData, tool.validation?.stripUnknown);
    const validatedBody = this.parseSchema(tool.validation?.body, bodyData, tool.validation?.stripUnknown);

    return {
      ...(this.isPlainObject(validatedParams) ? validatedParams : {}),
      ...(this.isPlainObject(validatedQuery) ? validatedQuery : {}),
      ...(this.isPlainObject(validatedBody) ? validatedBody : {}),
    };
  }

  private parseSchema(schema: McpValidationSchema | undefined, data: unknown, stripUnknown?: boolean): unknown {
    if (!schema) return undefined;

    const parser = stripUnknown && typeof schema.strip === 'function'
      ? schema.strip()
      : schema;

    return parser.parse(data);
  }

  private isPlainObject(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private getParameterNames(func: Function): string[] {
    const cached = this.parameterNamesCache.get(func);
    if (cached) {
      return cached;
    }

    const source = func
      .toString()
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const names = this.parseParameterList(source);
    this.parameterNamesCache.set(func, names);
    return names;
  }

  /**
   * Extract parameter names from a function's source. Uses a balanced scan over
   * (), [], {} and string/template literals so destructured params, defaults
   * containing parens/commas (`x = f(1, 2)`), and arrow/function-type
   * annotations don't truncate or mis-split the list.
   */
  private parseParameterList(source: string): string[] {
    const start = source.indexOf('(');
    if (start === -1) return [];

    let depth = 0;
    let end = -1;
    let quote: string | null = null;

    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') { i++; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    if (end === -1) return [];

    return this.splitTopLevel(source.slice(start + 1, end), ',')
      .map((param) => this.parameterName(param))
      .filter((name): name is string => Boolean(name));
  }

  private splitTopLevel(input: string, separator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let current = '';

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quote) {
        current += ch;
        if (ch === '\\' && i + 1 < input.length) { current += input[++i]; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') { depth++; current += ch; continue; }
      if (ch === ')' || ch === ']' || ch === '}') { depth--; current += ch; continue; }
      if (ch === separator && depth === 0) { parts.push(current); current = ''; continue; }
      current += ch;
    }

    if (current.trim()) parts.push(current);
    return parts;
  }

  private parameterName(param: string): string {
    let p = this.sliceBeforeTopLevel(param.trim(), '=').trim();

    // Destructured ({...}/[...]) and rest (...x) params have no single name we
    // can map a flat MCP key onto.
    if (!p || p.startsWith('{') || p.startsWith('[') || p.startsWith('...')) {
      return '';
    }

    p = this.sliceBeforeTopLevel(p, ':').trim();
    const tokens = p.split(/\s+/).filter(Boolean);
    return tokens[tokens.length - 1] ?? '';
  }

  private sliceBeforeTopLevel(input: string, char: string): string {
    let depth = 0;
    let quote: string | null = null;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quote) {
        if (ch === '\\') { i++; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === char && depth === 0) return input.slice(0, i);
    }

    return input;
  }

  private withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    if (ms <= 0) return fn();

    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new McpException('Tool execution timed out', McpErrorCode.UNAVAILABLE)),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(timer!));
  }

  private toToolResult(value: any) {
    if (value == null) {
      return {
        content: [{ type: 'text' as const, text: 'OK' }],
      };
    }

    if (value && typeof value === 'object' && Array.isArray(value.content)) {
      return value;
    }

    return {
      content: [{ type: 'text' as const, text: this.serialize(value) }],
    };
  }

  private serialize(value: any): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      const json = JSON.stringify(value, null, 2);
      return typeof json === 'string' ? json : String(value);
    } catch {
      return String(value);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error ?? 'Unknown MCP error');
  }

  private buildErrorResult(error: unknown) {
    if (error instanceof McpException) {
      return {
        content: [{ type: 'text' as const, text: `Error (${error.code}): ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text' as const, text: this.errorMessage(error) }],
      isError: true,
    };
  }
}
