import { jsonSchema, tool } from 'ai';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z, type ZodTypeAny, type ZodRawShape } from 'zod';
import type { McpBuilderService } from 'najm-mcp';
import { resolveRegisteredToolInputSchema } from 'najm-mcp';
import type { RegisteredTool } from 'najm-mcp';

export interface BuildAiSdkToolsOptions {
  blockConfirmationTools?: boolean;
  readOnlyMessage?: (tool: RegisteredTool) => string;
}

const DEFAULT_READ_ONLY_MESSAGE =
  'For safety, this assistant can currently read and search data only. Actions that create, update, delete, checkout, assign, remove, or clear data will be available after confirmation approval is added.';

const EMPTY_OBJECT_JSON_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
};

function getZodDef(schema: any): any {
  return schema?._def ?? schema?._zod?.def;
}

function getZodKind(schema: any): string {
  const def = getZodDef(schema);
  return String(def?.type ?? def?.typeName ?? schema?.constructor?.name ?? '').toLowerCase();
}

function isOptionalSchema(schema: any): boolean {
  const kind = getZodKind(schema);
  return kind.includes('optional') || kind.includes('default');
}

function unwrapSchema(schema: any): any {
  let current = schema;
  const seen = new Set<any>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const def = getZodDef(current);
    const inner = def?.innerType ?? def?.schema;
    if (!inner) break;
    current = inner;
  }

  return current;
}

function zodFieldToJsonSchema(schema: any): Record<string, unknown> {
  const unwrapped = unwrapSchema(schema);
  const def = getZodDef(unwrapped);
  const kind = getZodKind(unwrapped);
  const description = typeof unwrapped?.description === 'string' ? unwrapped.description : undefined;
  let json: Record<string, unknown>;

  if (kind.includes('string')) {
    json = { type: 'string' };
  } else if (kind.includes('number')) {
    json = { type: 'number' };
  } else if (kind.includes('bigint') || kind.includes('integer')) {
    json = { type: 'integer' };
  } else if (kind.includes('boolean')) {
    json = { type: 'boolean' };
  } else if (kind.includes('array')) {
    json = {
      type: 'array',
      items: zodFieldToJsonSchema(def?.element ?? def?.type),
    };
  } else if (kind.includes('enum')) {
    json = {
      type: 'string',
      enum: Object.values(def?.entries ?? def?.values ?? {}),
    };
  } else if (kind.includes('object')) {
    json = zodShapeToJsonSchema(typeof def?.shape === 'function' ? def.shape() : def?.shape);
  } else {
    json = {};
  }

  if (description) json.description = description;
  return json;
}

function zodShapeToJsonSchema(shape?: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, schema] of Object.entries(shape ?? {})) {
    properties[key] = zodFieldToJsonSchema(schema);
    if (!isOptionalSchema(schema)) required.push(key);
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

const toolSchemaCache = new WeakMap<RegisteredTool, ReturnType<typeof jsonSchema>>();

export function toolParametersSchema(mcpTool: RegisteredTool) {
  const cached = toolSchemaCache.get(mcpTool);
  if (cached) return cached;
  const shape = resolveRegisteredToolInputSchema(mcpTool);
  const schema = jsonSchema(shape ? zodShapeToJsonSchema(shape) : EMPTY_OBJECT_JSON_SCHEMA);
  toolSchemaCache.set(mcpTool, schema);
  return schema;
}

/**
 * @deprecated Use buildAiSdkTools with RegisteredTool[] from najm-mcp instead.
 * This JSON-schema-to-Zod converter is lossy and does not support all Zod features.
 */
export function schemaToZod(inputSchema?: {
  properties?: Record<string, unknown>;
  required?: string[];
}): z.ZodObject<ZodRawShape> {
  if (!inputSchema?.properties) return z.object({});

  const required = inputSchema.required ?? [];
  const shape: Record<string, ZodTypeAny> = {};

  for (const [key, def] of Object.entries(inputSchema.properties)) {
    const d = def as { type?: string; description?: string; enum?: string[] };
    let field: ZodTypeAny;

    if (d.enum) {
      field = z.enum(d.enum as [string, ...string[]]);
    } else if (d.type === 'number' || d.type === 'integer') {
      field = z.number();
    } else if (d.type === 'boolean') {
      field = z.boolean();
    } else if (d.type === 'array') {
      field = z.array(z.unknown());
    } else if (d.type === 'object') {
      field = z.record(z.string(), z.unknown());
    } else {
      field = z.string();
    }

    if (d.description) field = field.describe(d.description);
    if (!required.includes(key)) field = field.optional() as ZodTypeAny;
    shape[key] = field;
  }

  return z.object(shape as ZodRawShape);
}

// Callers must invoke this inside the request ALS scope so @User/@Policy/guards resolve from the caller's context — the returned tool.execute delegates to builder.invokeTool which does NOT open a new scope.
export function buildAiSdkTools(
  builder: McpBuilderService,
  tools: RegisteredTool[],
  options: BuildAiSdkToolsOptions = {},
): Record<string, any> {
  const aiSdkTools: Record<string, any> = {};
  const t = tool as any;

  for (const mcpTool of tools) {
    const schema = toolParametersSchema(mcpTool);

    aiSdkTools[mcpTool.name] = t({
      description: mcpTool.description ?? mcpTool.name,
      parameters: schema,
      execute: async (args: any) => {
        if (options.blockConfirmationTools === true && mcpTool.confirmation) {
          return options.readOnlyMessage?.(mcpTool) ?? DEFAULT_READ_ONLY_MESSAGE;
        }

        const result = await builder.invokeTool(mcpTool.name, args as Record<string, any>);
        const content = result.content?.[0];
        return content?.text ?? JSON.stringify(result);
      },
    });
  }

  return aiSdkTools;
}
