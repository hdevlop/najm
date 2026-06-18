import {
  Meta,
  Service,
  Inject,
  Scan,
  ScanType,
  ScannerService,
  LoggerService,
  getParameterMetadata,
  type ParameterMetadata,
} from 'najm-core';
import {
  getMcpAnnotations,
  getMcpConfirmation,
  getMcpControllerTools,
  getMcpToolGroup,
  getMcpTools,
} from './decorator';
import { McpRegistryService } from './McpRegistryService';
import { getSchemaShape } from './schemaUtils';
import type { McpValidationConfig } from './types';

@Service()
@Meta({ layer: 'plugin', order: 39 })
export class McpScannerService {
  @Scan() private scanner!: ScannerService;
  @Inject() private registry!: McpRegistryService;
  @Inject(LoggerService) private log!: LoggerService;

  private validationGetter?: (target: any, methodName?: string | symbol) => McpValidationConfig | undefined;

  async scan(): Promise<void> {
    await this.loadValidationGetter();
    this.registry.clear();

    this.scanner.scan(ScanType.CONTROLLER, {
      onClass: (target) => {
        const mcpMethods = getMcpControllerTools(target);
        if (mcpMethods.length === 0) return;

        this.registerControllerTools(target, mcpMethods);
      },
    });
  }

  private registerControllerTools(target: any, mcpMethods: (string | symbol)[]): void {
    const group = getMcpToolGroup(target);
    const tools = getMcpTools(target).filter((tool) => mcpMethods.includes(tool.methodKey));

    for (const tool of tools) {
      const method = target.prototype[tool.methodKey as any];
      if (!method) continue;

      const annotations = getMcpAnnotations(method);
      const confirmation = getMcpConfirmation(method);
      const validation = this.getValidationConfig(target, tool.methodKey, method);
      const validationArgs = this.getValidationArgNames(validation);
      const validationParamKeys = this.getParamKeyNames(validation);
      const validationQueryKeys = this.getQueryKeyNames(validation);
      const name = group ? `${group}_${tool.name}` : tool.name;

      this.warnUnsupportedParameters(name, method);

      this.registry.registerTool({
        ...tool,
        name,
        group,
        localName: tool.name,
        target,
        annotations,
        validation,
        validationArgs,
        validationParamKeys,
        validationQueryKeys,
        confirmation,
      });
    }
  }

  private async loadValidationGetter(): Promise<void> {
    if (this.validationGetter) return;

    try {
      const mod = await import('najm-validation');
      const getter = (mod as any).getValidationConfig;

      if (typeof getter === 'function') {
        this.validationGetter = getter;
      }
    } catch {
      this.validationGetter = undefined;
    }
  }

  private getValidationConfig(
    target: any,
    methodKey: string | symbol,
    method: Function,
  ): McpValidationConfig | undefined {
    const fromGetter = this.validationGetter?.(target.prototype, methodKey);
    if (this.isValidationConfig(fromGetter)) return fromGetter;

    const key = Reflect.getMetadataKeys(method).find((metaKey: unknown) => {
      return typeof metaKey === 'symbol' && metaKey.description === 'validate';
    });

    if (!key) return undefined;

    const raw = Reflect.getMetadata(key, method);
    return this.isValidationConfig(raw) ? raw : undefined;
  }

  private isValidationConfig(value: unknown): value is McpValidationConfig {
    return !!value && typeof value === 'object';
  }

  private getValidationArgNames(config?: McpValidationConfig): string[] | undefined {
    const shape = getSchemaShape(config?.body);
    return shape ? Object.keys(shape) : undefined;
  }

  private getParamKeyNames(config?: McpValidationConfig): string[] | undefined {
    const shape = getSchemaShape(config?.params);
    return shape ? Object.keys(shape) : undefined;
  }

  private getQueryKeyNames(config?: McpValidationConfig): string[] | undefined {
    const shape = getSchemaShape(config?.query);
    return shape ? Object.keys(shape) : undefined;
  }

  /**
   * Parameter decorator types the MCP invoker can resolve from a tool call.
   * Anything else has no MCP-side source and would resolve to `undefined` at
   * runtime, so we surface it at scan time instead of failing silently.
   */
  private static readonly SUPPORTED_PARAM_TYPES = new Set([
    'body', 'json', 'text', 'formData', 'arrayBuffer', 'blob',
    'params', 'query', 'queries',
    'user', 'owner', 'info', 'data', 'filter', 'guardParams', 'role', 'permissions',
  ]);

  private warnUnsupportedParameters(toolName: string, method: Function): void {
    const metadata = (getParameterMetadata(method) ?? []) as ParameterMetadata[];

    for (const meta of metadata) {
      if (!McpScannerService.SUPPORTED_PARAM_TYPES.has(meta.type)) {
        this.log.warn(
          `[najm-mcp] Tool "${toolName}" parameter #${meta.index} uses @${meta.type} ` +
          `which has no MCP source and will resolve to undefined when called as a tool.`,
        );
      }
    }
  }
}
