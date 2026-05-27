import 'reflect-metadata';
import { MetaHelper } from 'najm-core';
import {
  MCP_ANNOTATIONS_META,
  MCP_CONFIRMATION_META,
  MCP_CONTROLLER_TOOL_META,
  MCP_GROUP_META,
  MCP_TOOL_META,
} from './tokens';
import type { McpAnnotations, McpToolConfirm, McpToolConfirmation, ToolMeta } from './types';

export function Tool(meta: string | Omit<ToolMeta, 'methodKey'>): MethodDecorator {
  return (target: any, methodKey: string | symbol) => {
    const normalized: Omit<ToolMeta, 'methodKey'> =
      typeof meta === 'string'
        ? { name: toSnakeCase(String(methodKey)), description: meta }
        : meta;

    MetaHelper.append<ToolMeta>(
      MCP_TOOL_META,
      { ...normalized, methodKey },
      target.constructor
    );
  };
}

export function ToolGroup(prefix: string): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(MCP_GROUP_META, prefix, target);
  };
}

/**
 * @deprecated Use object-form `@McpTool({ description, destructive, readOnly, idempotent, openWorld })` instead.
 * Will be removed in the next minor version.
 */
export function Annotations(annotations: McpAnnotations): MethodDecorator {
  return (target: any, methodKey: string | symbol) => {
    Reflect.defineMetadata(MCP_ANNOTATIONS_META, annotations, target[methodKey as any]);
  };
}

export function McpTool(
  meta: string | {
    description: string;
    readOnly?: boolean;
    destructive?: boolean;
    idempotent?: boolean;
    openWorld?: boolean;
    confirm?: McpToolConfirm;
  }
): MethodDecorator {
  return (target: any, methodKey: string | symbol) => {
    const description = typeof meta === 'string' ? meta : meta.description;
    Tool(description)(target, methodKey, Object.getOwnPropertyDescriptor(target, methodKey)!);

    const existing: (string | symbol)[] = MetaHelper.get(MCP_CONTROLLER_TOOL_META, target.constructor) ?? [];
    existing.push(methodKey);
    MetaHelper.define(MCP_CONTROLLER_TOOL_META, existing, target.constructor);

    if (typeof meta === 'object') {
      const annotations: McpAnnotations = {};
      if (meta.readOnly !== undefined) annotations.readOnlyHint = meta.readOnly;
      if (meta.destructive !== undefined) annotations.destructive = meta.destructive;
      if (meta.idempotent !== undefined) annotations.idempotent = meta.idempotent;
      if (meta.openWorld !== undefined) annotations.openWorldHint = meta.openWorld;

      if (Object.keys(annotations).length > 0) {
        Reflect.defineMetadata(MCP_ANNOTATIONS_META, annotations, target[methodKey as any]);
      }

      const confirmation = normalizeConfirmation(meta.confirm);
      if (confirmation) {
        Reflect.defineMetadata(MCP_CONFIRMATION_META, confirmation, target[methodKey as any]);
      }
    }
  };
}

export const getMcpTools = (target: any): ToolMeta[] => MetaHelper.get(MCP_TOOL_META, target) ?? [];
export const getMcpToolGroup = (target: any): string | undefined => Reflect.getMetadata(MCP_GROUP_META, target);
export const getMcpAnnotations = (target: any): McpAnnotations | undefined => Reflect.getMetadata(MCP_ANNOTATIONS_META, target);
export const getMcpConfirmation = (target: any): McpToolConfirmation | undefined => Reflect.getMetadata(MCP_CONFIRMATION_META, target);

export function getMcpControllerTools(target: any): (string | symbol)[] {
  return MetaHelper.get(MCP_CONTROLLER_TOOL_META, target) ?? [];
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function normalizeConfirmation(confirm?: McpToolConfirm): McpToolConfirmation | undefined {
  if (!confirm) return undefined;
  if (confirm === true) return {};
  return confirm;
}
