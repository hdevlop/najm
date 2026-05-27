import { Meta, Service, Inject, Scan, ScanType, ScannerService } from 'najm-core';
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
      const name = group ? `${group}_${tool.name}` : tool.name;

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
}
