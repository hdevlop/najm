import { Container, MetaHelper } from 'diject';
import { INJECTION_TYPES } from '../scanner';
import type { RouteEntry } from './types';

const VALIDATE_META = Symbol.for('najm:validate');

export interface OpenAPIGenerateOptions {
   title?: string;
   version?: string;
   description?: string;
   servers?: Array<{ url: string; description?: string }>;
   securitySchemes?: Record<string, unknown>;
   security?: Array<Record<string, string[]>>;
}

export interface OpenAPIDocument {
   openapi: '3.1.0';
   info: {
      title: string;
      version: string;
      description?: string;
   };
   servers?: Array<{ url: string; description?: string }>;
   paths: Record<string, Record<string, OpenAPIOperation>>;
   components?: {
      securitySchemes?: Record<string, unknown>;
   };
   security?: Array<Record<string, string[]>>;
}

export interface OpenAPIOperation {
   operationId: string;
   tags: string[];
   parameters?: OpenAPIParameter[];
   requestBody?: {
      required: boolean;
      content: {
         'application/json': {
            schema: Record<string, unknown>;
         };
      };
   };
   responses: Record<string, {
      description: string;
      content?: {
         'application/json': {
            schema: Record<string, unknown>;
         };
      };
   }>;
}

export interface OpenAPIParameter {
   name: string;
   in: 'path' | 'query' | 'header';
   required: boolean;
   schema: Record<string, unknown>;
}

interface ValidationConfigLike {
   body?: unknown;
   params?: unknown;
   query?: unknown;
   headers?: unknown;
}

export function generateOpenAPI(
   container: Container,
   options: OpenAPIGenerateOptions = {},
): OpenAPIDocument {
   const routes = container.getInjections<RouteEntry>(INJECTION_TYPES.ROUTE);
   const paths: OpenAPIDocument['paths'] = {};

   for (const route of routes) {
      const path = toOpenAPIPath(route.path);
      const method = route.method.toLowerCase();
      const validation = getValidationConfig(route);
      const parameters = buildParameters(route.path, validation);
      const operation: OpenAPIOperation = {
         operationId: `${route.target.name}_${String(route.methodName)}`,
         tags: [tagFromController(route.target.name)],
         responses: {
            '200': {
               description: 'Successful response',
               content: {
                  'application/json': {
                     schema: {},
                  },
               },
            },
         },
      };

      if (parameters.length > 0) {
         operation.parameters = parameters;
      }

      if (validation?.body) {
         operation.requestBody = {
            required: true,
            content: {
               'application/json': {
                  schema: schemaToJsonSchema(validation.body),
               },
            },
         };
      }

      paths[path] ??= {};
      paths[path][method] = operation;
   }

   const document: OpenAPIDocument = {
      openapi: '3.1.0',
      info: {
         title: options.title ?? 'Najm API',
         version: options.version ?? '1.0.0',
         description: options.description,
      },
      paths,
   };

   if (options.servers?.length) {
      document.servers = options.servers;
   }

   if (options.securitySchemes && Object.keys(options.securitySchemes).length > 0) {
      document.components = {
         securitySchemes: options.securitySchemes,
      };
   }

   if (options.security?.length) {
      document.security = options.security;
   }

   return document;
}

function getValidationConfig(route: RouteEntry): ValidationConfigLike | undefined {
   return MetaHelper.get<ValidationConfigLike>(VALIDATE_META, route.handler);
}

function tagFromController(name: string): string {
   return name.replace(/Controller$/, '') || 'Default';
}

function toOpenAPIPath(path: string): string {
   return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function buildParameters(routePath: string, validation?: ValidationConfigLike): OpenAPIParameter[] {
   const parameters: OpenAPIParameter[] = [];
   const pathSchemas = objectProperties(validation?.params);

   for (const name of routePath.matchAll(/:([A-Za-z0-9_]+)/g)) {
      const key = name[1];
      parameters.push({
         name: key,
         in: 'path',
         required: true,
         schema: pathSchemas[key] ? schemaToJsonSchema(pathSchemas[key]) : { type: 'string' },
      });
   }

   appendParameters(parameters, 'query', validation?.query);
   appendParameters(parameters, 'header', validation?.headers);

   return parameters;
}

function appendParameters(
   parameters: OpenAPIParameter[],
   location: 'query' | 'header',
   schema: unknown,
): void {
   const properties = objectProperties(schema);
   const required = new Set(objectRequiredKeys(schema));

   for (const [name, propertySchema] of Object.entries(properties)) {
      parameters.push({
         name,
         in: location,
         required: required.has(name),
         schema: schemaToJsonSchema(propertySchema),
      });
   }
}

function objectProperties(schema: unknown): Record<string, unknown> {
   const def = getZodDef(schema);
   const shape = typeof def?.shape === 'function' ? def.shape() : def?.shape;
   return shape && typeof shape === 'object' ? shape as Record<string, unknown> : {};
}

function objectRequiredKeys(schema: unknown): string[] {
   return Object.entries(objectProperties(schema))
      .filter(([, propertySchema]) => !isOptionalSchema(propertySchema))
      .map(([name]) => name);
}

function schemaToJsonSchema(schema: unknown): Record<string, unknown> {
   const nullable = isNullableSchema(schema);
   const unwrapped = unwrapSchema(schema);
   const def = getZodDef(unwrapped);
   const kind = getZodKind(unwrapped);
   const description = typeof (unwrapped as { description?: unknown })?.description === 'string'
      ? (unwrapped as { description: string }).description
      : undefined;
   let json: Record<string, unknown>;

   if (kind.includes('string')) {
      json = { type: 'string', ...stringConstraints(def) };
   } else if (kind.includes('number')) {
      json = { type: 'number' };
   } else if (kind.includes('bigint') || kind.includes('integer')) {
      json = { type: 'integer' };
   } else if (kind.includes('boolean')) {
      json = { type: 'boolean' };
   } else if (kind.includes('date')) {
      json = { type: 'string', format: 'date-time' };
   } else if (kind.includes('array')) {
      json = {
         type: 'array',
         items: schemaToJsonSchema(def?.element ?? def?.type),
      };
   } else if (kind.includes('enum')) {
      json = {
         type: 'string',
         enum: Object.values(def?.entries ?? def?.values ?? {}),
      };
   } else if (kind.includes('literal')) {
      const values = def?.values ?? (def?.value !== undefined ? [def.value] : []);
      json = { enum: values };
   } else if (kind.includes('union')) {
      json = {
         anyOf: (def?.options ?? []).map((option: unknown) => schemaToJsonSchema(option)),
      };
   } else if (kind.includes('object')) {
      json = objectToJsonSchema(unwrapped);
   } else if (kind.includes('record')) {
      json = {
         type: 'object',
         additionalProperties: schemaToJsonSchema(def?.valueType ?? def?.value ?? def?.schema),
      };
   } else {
      json = {};
   }

   if (description) {
      json.description = description;
   }

   return nullable ? withNullable(json) : json;
}

function objectToJsonSchema(schema: unknown): Record<string, unknown> {
   const properties: Record<string, unknown> = {};
   const required: string[] = [];

   for (const [key, propertySchema] of Object.entries(objectProperties(schema))) {
      properties[key] = schemaToJsonSchema(propertySchema);
      if (!isOptionalSchema(propertySchema)) {
         required.push(key);
      }
   }

   return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
   };
}

function getZodDef(schema: unknown): any {
   const candidate = schema as { _zod?: { def?: unknown }; _def?: unknown } | undefined;
   return candidate?._zod?.def ?? candidate?._def;
}

function getZodKind(schema: unknown): string {
   const def = getZodDef(schema);
   return String(def?.type ?? def?.typeName ?? (schema as { constructor?: { name?: string } })?.constructor?.name ?? '')
      .toLowerCase();
}

function isOptionalSchema(schema: unknown): boolean {
   const kind = getZodKind(schema);
   return kind.includes('optional') || kind.includes('default');
}

function isNullableSchema(schema: unknown): boolean {
   let current = schema;
   const seen = new Set<unknown>();

   while (current && !seen.has(current)) {
      seen.add(current);
      const kind = getZodKind(current);
      if (kind.includes('nullable')) return true;
      const def = getZodDef(current);
      const inner = def?.innerType ?? def?.schema;
      if (!inner) break;
      current = inner;
   }

   return false;
}

function unwrapSchema(schema: unknown): unknown {
   let current = schema;
   const seen = new Set<unknown>();

   while (current && !seen.has(current)) {
      seen.add(current);
      const kind = getZodKind(current);
      if (!isWrapperKind(kind)) break;
      const def = getZodDef(current);
      const inner = def?.innerType ?? def?.schema;
      if (!inner) break;
      current = inner;
   }

   return current;
}

function isWrapperKind(kind: string): boolean {
   return [
      'optional',
      'nullable',
      'default',
      'catch',
      'readonly',
      'pipe',
      'effects',
      'promise',
   ].some((wrapper) => kind.includes(wrapper));
}

function withNullable(schema: Record<string, unknown>): Record<string, unknown> {
   if (typeof schema.type === 'string') {
      return {
         ...schema,
         type: [schema.type, 'null'],
      };
   }

   return {
      anyOf: [schema, { type: 'null' }],
   };
}

function stringConstraints(def: any): Record<string, unknown> {
   const json: Record<string, unknown> = {};

   for (const check of def?.checks ?? []) {
      const checkDef = check?._zod?.def ?? check;
      const kind = String(checkDef?.check ?? checkDef?.kind ?? '').toLowerCase();
      const format = String(checkDef?.format ?? '').toLowerCase();

      if (kind.includes('min')) {
         json.minLength = checkDef?.minimum ?? checkDef?.value;
      } else if (kind.includes('max')) {
         json.maxLength = checkDef?.maximum ?? checkDef?.value;
      }

      if (format === 'email' || kind.includes('email')) {
         json.format = 'email';
      } else if (format === 'uuid' || kind.includes('uuid')) {
         json.format = 'uuid';
      } else if (format === 'url' || kind.includes('url')) {
         json.format = 'uri';
      } else if (format === 'datetime' || kind.includes('datetime')) {
         json.format = 'date-time';
      }
   }

   return Object.fromEntries(
      Object.entries(json).filter(([, value]) => value !== undefined),
   );
}
