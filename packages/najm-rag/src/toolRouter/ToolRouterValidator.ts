import { Service } from 'najm-core';
import { existsSync } from 'fs';
import { chatbotRoutingJsonSchema } from './ToolRouterDto';
import { deepEqual } from './ToolRouterUtils';

@Service()
export class ToolRouterValidator {
  assertFilePath(path: string | undefined): asserts path is string {
    if (!path) {
      throw new Error(
        'Chatbot routing config provider error: source.type is "jsonFile" but source.path is empty. ' +
          'Provide a valid file path.',
      );
    }
  }

  assertFileExists(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Routing config file not found: ${filePath}`);
    }
  }

  assertValidConfig(parsed: unknown): ReturnType<typeof chatbotRoutingJsonSchema.parse> {
    const result = chatbotRoutingJsonSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid routing config: ${issues}`);
    }
    return result.data;
  }

  assertRagUnchanged(current: unknown, baseline: unknown): void {
    if (!deepEqual(current, baseline)) {
      throw new Error(
        'Routing config reload rejected: rag block changes require a server restart. ' +
          'Only toolRouting consumer-level blocks are hot-swappable.',
      );
    }
  }
}
