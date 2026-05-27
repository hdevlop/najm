import { Service, Inject, HttpError, DI, type Container, getParameterMetadata } from 'najm-core';
import { McpRegistryService, resolveRegisteredToolInputSchema, type McpToolConfirmation, type RegisteredTool } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { ToolIndexRepository } from '../toolIndex';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';
import { getRoutableTools } from '../toolVisibility';

type ToolParameterResponse = {
  name: string;
  type: string;
  required: boolean;
  smartResolver?: {
    accepts: string[];
    examples: string[];
  };
};
type ConfirmationResponse = McpToolConfirmation & { resolvedMessage?: string };

@Service()
export class ToolMetadataService {
  @Inject() private settings?: RoutingSettingsService;
  @DI() private container!: Container;

  constructor(
    @Inject() private repository: ToolIndexRepository,
    @Inject() private registry: McpRegistryService,
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
  ) {}

  async getToolList(): Promise<Array<{ id: string; name: string; group: string; description: string; schemaFingerprint: string; indexed: boolean; dependencies: string[]; parameters: ToolParameterResponse[]; confirmation?: ConfirmationResponse }>> {
    const rows = await this.repository.listEmbeddings();
    const settings = this.settings ? await this.settings.getEffectiveSettings() : null;
    const dependencies = settings?.dependencies ?? this.config.toolRouting.dependencies ?? {};
    const rowByName = new Map(rows.map((row) => [row.toolName, row]));
    return getRoutableTools(this.registry.tools).map((tool) => ({
      id: tool.name,
      name: tool.name,
      group: tool.group ?? 'default',
      description: tool.description,
      schemaFingerprint: rowByName.get(tool.name)?.fingerprint ?? '',
      indexed: rowByName.get(tool.name)?.embedding != null,
      dependencies: dependencies[tool.name] ?? [],
      parameters: this.getToolParameters(tool),
      confirmation: this.resolveConfirmation(tool.confirmation),
    }));
  }

  async addToolDependency(toolName: string, dependencyName: string) {
    toolName = toolName.trim();
    if (!dependencyName.trim()) HttpError.badRequest('dependency is required.');
    dependencyName = dependencyName.trim();
    this.assertRegisteredTool(toolName);
    this.assertRegisteredTool(dependencyName);
    if (toolName === dependencyName) HttpError.badRequest('A tool cannot depend on itself.');

    const settings = this.settings ? await this.settings.getEffectiveSettings() : null;
    const deps = { ...(settings?.dependencies ?? this.config.toolRouting.dependencies ?? {}) };
    const existing = deps[toolName] ?? [];
    deps[toolName] = existing.includes(dependencyName)
      ? existing
      : [...existing, dependencyName];

    if (!this.settings) HttpError.internal('Routing settings service is not available.');
    const result = await this.settings.updateSettings({ dependencies: deps });
    return { toolName, dependencies: result.dependencies[toolName] ?? [] };
  }

  async removeToolDependency(toolName: string, dependencyName: string) {
    toolName = toolName.trim();
    dependencyName = dependencyName.trim();
    this.assertRegisteredTool(toolName);
    const settings = this.settings ? await this.settings.getEffectiveSettings() : null;
    const deps = { ...(settings?.dependencies ?? this.config.toolRouting.dependencies ?? {}) };
    deps[toolName] = (deps[toolName] ?? []).filter((name) => name !== dependencyName);
    if (deps[toolName].length === 0) delete deps[toolName];

    if (!this.settings) HttpError.internal('Routing settings service is not available.');
    const result = await this.settings.updateSettings({ dependencies: deps });
    return { toolName, dependencies: result.dependencies[toolName] ?? [] };
  }

  private assertRegisteredTool(toolName: string) {
    if (!getRoutableTools(this.registry.tools).some((tool) => tool.name === toolName)) {
      HttpError.notFound(`MCP tool not found: ${toolName}`);
    }
  }

  private getToolParameters(tool?: RegisteredTool): ToolParameterResponse[] {
    if (!tool) return [];

    const inputSchema = resolveRegisteredToolInputSchema(tool);
    if (inputSchema && Object.keys(inputSchema).length > 0) {
      return Object.entries(inputSchema).map(([name, schema]) => {
        const shape = schema as Record<string, any>;
        const isOptional = shape?.isOptional?.() === true || shape?.optional === true || shape?._def?.typeName === 'ZodOptional';
        const typeName = this.resolveSchemaTypeName(shape);
        return this.withSmartResolverHint(tool, { name, type: typeName, required: !isOptional });
      });
    }

    return this.extractToolParametersFromMethod(tool);
  }

  private resolveSchemaTypeName(schema: any): string {
    if (!schema || typeof schema !== 'object') return 'unknown';

    const def = schema._zod?.def ?? schema._def;
    if (def) {
      const type = def.type;
      // Unwrap Zod v4 wrapper types to reach the inner type
      if (
        type === 'optional' ||
        type === 'default' ||
        type === 'exact_optional' ||
        type === 'nullable' ||
        type === 'nullish' ||
        type === 'catch' ||
        type === 'readonly' ||
        type === 'nonoptional'
      ) {
        return this.resolveSchemaTypeName(def.innerType);
      }
      if (typeof type === 'string') return type;
    }

    // Zod v3 fallback
    if (typeof schema._def?.typeName === 'string') {
      const typeName = schema._def.typeName;
      if (
        typeName === 'ZodOptional' ||
        typeName === 'ZodDefault' ||
        typeName === 'ZodNullable' ||
        typeName === 'ZodNullish' ||
        typeName === 'ZodCatch'
      ) {
        return this.resolveSchemaTypeName(schema._def.innerType);
      }
      return typeName.replace(/^Zod/, '').toLowerCase();
    }

    if (typeof schema.type === 'string') return schema.type;

    return 'unknown';
  }

  private extractToolParametersFromMethod(tool: RegisteredTool): ToolParameterResponse[] {
    try {
      const method = tool.target?.prototype?.[tool.methodKey as any];
      if (typeof method !== 'function') return [];

      let paramMeta: Array<{ index: number; type: string; propertyKey?: string }> = [];
      try {
        const raw = getParameterMetadata(method) as Array<{ index: number; type: string; propertyKey?: string }> | undefined;
        if (raw && raw.length > 0) paramMeta = raw;
      } catch {}

      const source = method.toString().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const start = source.indexOf('(');
      const end = source.indexOf(')');
      if (start === -1 || end === -1 || end <= start) return [];

      const names = source
        .slice(start + 1, end)
        .split(',')
        .map((p: string) => p.trim().split(/[=:]/)[0].trim())
        .filter(Boolean);

      if (paramMeta.length > 0) {
        const seen = new Set<string>();
        const params: ToolParameterResponse[] = [];

        for (const meta of paramMeta.sort((a, b) => a.index - b.index)) {
          const parameter = this.toToolParameter(meta, names[meta.index]);
          if (!parameter || seen.has(parameter.name)) continue;
          seen.add(parameter.name);
          params.push(this.withSmartResolverHint(tool, parameter));
        }

        return params;
      }

      return names.map((name) => this.withSmartResolverHint(tool, { name, type: 'unknown', required: true }));
    } catch {
      return [];
    }
  }

  private toToolParameter(
    meta: { type: string; propertyKey?: string },
    sourceName?: string,
  ): ToolParameterResponse | null {
    if (meta.type === 'params') {
      return {
        name: meta.propertyKey ?? sourceName ?? 'params',
        type: 'unknown',
        required: true,
      };
    }

    if (this.isBodyParamType(meta.type)) {
      return {
        name: meta.propertyKey ?? 'body',
        type: 'unknown',
        required: true,
      };
    }

    return null;
  }

  private isBodyParamType(type: string): boolean {
    return type === 'body'
      || type === 'json'
      || type === 'text'
      || type === 'formData'
      || type === 'arrayBuffer'
      || type === 'blob';
  }

  private withSmartResolverHint(tool: RegisteredTool, parameter: ToolParameterResponse): ToolParameterResponse {
    if (!this.looksLikeSmartResolver(tool, parameter)) return parameter;
    const accepts = this.extractSmartResolverAccepts(tool.description);
    return {
      ...parameter,
      smartResolver: {
        accepts,
        examples: this.buildSmartResolverExamples(parameter.name, accepts),
      },
    };
  }

  private looksLikeSmartResolver(tool: RegisteredTool, parameter: ToolParameterResponse): boolean {
    if (parameter.type !== 'string') return false;
    if (!parameter.required) return false;
    const name = parameter.name.toLowerCase();
    if (['id', 'uuid', 'email', 'query', 'search'].includes(name)) return false;

    const description = tool.description.toLowerCase();
    const method = String(tool.localName ?? tool.methodKey ?? tool.name).toLowerCase();
    const hasResolverLanguage = /\b(resolve|ambiguous|ambiguity|candidate|candidates)\b/.test(description);
    const hasSmartMethodName = ['get', 'update', 'delete', 'resolve'].includes(method);
    const describesFlexibleLookup = /\bby\b.+\b(or|,)\b.+\b(id|name|email|code|slug|category|phone)\b/.test(description);

    return hasResolverLanguage || (hasSmartMethodName && describesFlexibleLookup && description.includes(name));
  }

  private extractSmartResolverAccepts(description: string): string[] {
    const fallback = ['id', 'name', 'code', 'slug'];
    const byMatch = description.match(/\bby\s+(.+?)(?:\.|;|$)/i);
    const text = byMatch?.[1] ?? '';
    const values = text
      .replace(/\bor\b/gi, ',')
      .replace(/\band\b/gi, ',')
      .split(',')
      .map((part) => part.trim().replace(/^a\s+|^an\s+|^the\s+/i, ''))
      .filter(Boolean)
      .filter((part) => !/^(your|one|of)$/.test(part.toLowerCase()));

    return values.length > 0 ? Array.from(new Set(values)) : fallback;
  }

  private buildSmartResolverExamples(paramName: string, accepts: string[]): string[] {
    const examplesByKind: Record<string, string> = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Samsung S12',
      title: 'Samsung S12',
      code: 'PROD-001',
      slug: 'samsung-s12',
      category: 'phones',
      email: 'user@example.com',
      phone: '+15551234567',
    };

    const values = accepts
      .map((accept) => examplesByKind[accept.toLowerCase()] ?? null)
      .filter((value): value is string => Boolean(value));

    const uniqueValues = Array.from(new Set(values));
    const fallback = paramName.toLowerCase() === 'product' ? ['Samsung S12', 'phones'] : ['search text'];
    return uniqueValues.length > 0 ? uniqueValues : fallback;
  }

  private resolveConfirmation(confirmation?: McpToolConfirmation): ConfirmationResponse | undefined {
    if (!confirmation) return undefined;
    const resolved: ConfirmationResponse = { ...confirmation };
    if (confirmation.message) {
      resolved.resolvedMessage = this.resolveI18nMessage(confirmation.message);
    }
    return resolved;
  }

  private resolveI18nMessage(message: string): string {
    try {
      const i18n = this.container?.get(Symbol.for('I18nService')) as { t?: (key: string) => string } | undefined;
      const translated = i18n?.t?.(message);
      return translated || message;
    } catch {
      return message;
    }
  }
}
