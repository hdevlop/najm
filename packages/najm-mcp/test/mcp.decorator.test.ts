import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { MetaHelper } from 'najm-core';
import { McpTool, Tool, ToolGroup } from '../src/decorator';
import {
  MCP_ANNOTATIONS_META,
  MCP_CONFIRMATION_META,
  MCP_CONTROLLER_TOOL_META,
  MCP_GROUP_META,
  MCP_TOOL_META,
} from '../src/tokens';
import { mcp } from '../src/McpPlugin';
import { McpBuilderService } from '../src/McpBuilderService';
import { McpRegistryService } from '../src/McpRegistryService';
import { McpScannerService } from '../src/McpScannerService';
import { McpTransportService } from '../src/McpTransportService';

describe('najm-mcp decorators', () => {
  test('@Tool stores class metadata with explicit name', () => {
    class DemoController {
      @Tool({ name: 'tool_a', description: 'Tool A', catchErrors: 'Tool A failed' })
      toolA() {
        return 'ok';
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('tool_a');
    expect(tools[0].catchErrors).toBe('Tool A failed');
  });

  test('@Tool accepts description shorthand and infers snake_case name', () => {
    class DemoController {
      @Tool('Search products')
      searchProducts() {
        return 'ok';
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_products');
    expect(tools[0].description).toBe('Search products');
  });

  test('@ToolGroup stores class group metadata', () => {
    @ToolGroup('orders')
    class DemoGroupedController {}

    expect(Reflect.getMetadata(MCP_GROUP_META, DemoGroupedController)).toBe('orders');
  });

  test('@McpTool registers method as both Tool and controller tool', () => {
    class DemoController {
      @McpTool('List all items')
      getAll() {
        return [];
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];
    const controllerTools = MetaHelper.get<any[]>(MCP_CONTROLLER_TOOL_META, DemoController) ?? [];

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_all');
    expect(tools[0].description).toBe('List all items');
    expect(controllerTools).toContain('getAll');
  });

  test('@McpTool object form stores description and annotations', () => {
    class DemoController {
      @McpTool({ description: 'Delete a product', destructive: true, readOnly: false })
      deleteProduct() {
        return 'ok';
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];
    const controllerTools = MetaHelper.get<any[]>(MCP_CONTROLLER_TOOL_META, DemoController) ?? [];
    const annotations = Reflect.getMetadata(MCP_ANNOTATIONS_META, DemoController.prototype.deleteProduct);

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('delete_product');
    expect(tools[0].description).toBe('Delete a product');
    expect(controllerTools).toContain('deleteProduct');
    expect(annotations).toEqual({ destructive: true, readOnlyHint: false });
  });

  test('@McpTool object form maps openWorld and idempotent correctly', () => {
    class DemoController {
      @McpTool({ description: 'Search web', openWorld: true, idempotent: true })
      searchWeb() {
        return 'ok';
      }
    }

    const annotations = Reflect.getMetadata(MCP_ANNOTATIONS_META, DemoController.prototype.searchWeb);
    expect(annotations).toEqual({ openWorldHint: true, idempotent: true });
  });

  test('@McpTool object form stores confirmation metadata', () => {
    class DemoController {
      @McpTool({
        description: 'Delete an item',
        destructive: true,
        confirm: {
          level: 'danger',
          message: 'items.confirm.delete',
        },
      })
      deleteItem() {
        return 'ok';
      }

      @McpTool({
        description: 'Create an item',
        idempotent: false,
        confirm: true,
      })
      createItem() {
        return 'ok';
      }
    }

    const deleteConfirmation = Reflect.getMetadata(MCP_CONFIRMATION_META, DemoController.prototype.deleteItem);
    const createConfirmation = Reflect.getMetadata(MCP_CONFIRMATION_META, DemoController.prototype.createItem);

    expect(deleteConfirmation).toEqual({ level: 'danger', message: 'items.confirm.delete' });
    expect(createConfirmation).toEqual({});
  });
});

describe('najm-mcp tool naming from method names (B1 contract)', () => {
  test('@ToolGroup("products") + method get() produces name products_get', () => {
    @ToolGroup('products')
    class DemoController {
      @McpTool('Get a product')
      get() {
        return {};
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get');
    expect(Reflect.getMetadata(MCP_GROUP_META, DemoController)).toBe('products');
  });

  test('@ToolGroup("products") + method getById() produces snake_case get_by_id', () => {
    @ToolGroup('products')
    class DemoController {
      @McpTool('Get by id')
      getById() {
        return {};
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_by_id');
  });

  test('tool name is generated from method name, not from HTTP route path', () => {
    @ToolGroup('products')
    class DemoController {
      @McpTool('Get a product by query')
      get() {
        return {};
      }

      @McpTool('Get by id')
      getById() {
        return {};
      }
    }

    const tools = MetaHelper.get<any[]>(MCP_TOOL_META, DemoController) ?? [];
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('get');
    expect(tools[1].name).toBe('get_by_id');
  });

  test('@McpTool({ readOnly: true }) sets annotations.readOnlyHint to true', () => {
    class DemoController {
      @McpTool({ description: 'Read-only tool', readOnly: true })
      get() {
        return {};
      }
    }

    const annotations = Reflect.getMetadata(MCP_ANNOTATIONS_META, DemoController.prototype.get);
    expect(annotations).toBeDefined();
    expect(annotations.readOnlyHint).toBe(true);
  });

  test('@McpTool({ confirm: { level, message } }) preserves confirmation metadata for write tools', () => {
    class DemoController {
      @McpTool({
        description: 'Update a product',
        confirm: { level: 'warning', message: 'confirm.products.update' },
      })
      update() {
        return {};
      }
    }

    const confirmation = Reflect.getMetadata(MCP_CONFIRMATION_META, DemoController.prototype.update);
    expect(confirmation).toEqual({ level: 'warning', message: 'confirm.products.update' });
  });
});

describe('najm-mcp plugin factory', () => {
  test('builds plugin with expected services and config', () => {
    const plugin = mcp({ name: 'x', version: '1.0.0' });

    expect(plugin.name).toBe('mcp');
    expect(plugin.services).toEqual([
      McpRegistryService,
      McpScannerService,
      McpBuilderService,
      McpTransportService,
    ]);
  });
});
