import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { chatbotRoutingJsonSchema } from '../toolRouter/ToolRouterDto';
import type { RagConfig } from '../config';

export function loadRagRoutingConfig(configPath?: string): Partial<RagConfig> {
  const envPath = process.env.CHATBOT_ROUTING_CONFIG_PATH;
  const targetPath = configPath
    ? isAbsolute(configPath)
      ? configPath
      : resolve(process.cwd(), configPath)
    : envPath
      ? resolve(envPath)
      : undefined;

  if (!targetPath || !existsSync(targetPath)) {
    if (envPath) {
      throw new Error(`CHATBOT_ROUTING_CONFIG_PATH points to missing file: ${envPath}`);
    }
    return {};
  }

  let raw: string;
  try {
    raw = readFileSync(targetPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read RAG routing config from ${targetPath}: ${error}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in RAG routing config (${targetPath}): ${error}`);
  }

  const validation = chatbotRoutingJsonSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`RAG routing config validation failed (${targetPath}): ${issues}`);
  }

  const data = validation.data;

  const result: Partial<RagConfig> = {};

  // Legacy mode migration
  if (data.mode !== undefined) {
    if (process.env.NAJM_NO_DEPRECATION_WARNINGS !== '1') {
      console.warn('[najm-rag deprecation] `mode` in routing.json is deprecated. Use `rag({ toolRouting: { enabled: true } })` instead.');
    }

    if (data.mode === 'routing') {
      result.embedding = result.embedding ?? {};
      result.indexOnBoot = result.indexOnBoot ?? true;
      result.toolRouting = { ...result.toolRouting, enabled: true };
    } else if (data.mode === 'rag') {
      result.embedding = result.embedding ?? {};
      result.indexOnBoot = result.indexOnBoot ?? true;
    } else if (data.mode === 'off') {
      result.toolRouting = { ...result.toolRouting, enabled: false };
    }
  }

  if (data.embedding !== undefined) result.embedding = data.embedding;
  if (data.indexOnBoot !== undefined) result.indexOnBoot = data.indexOnBoot;

  const toolRouting = result.toolRouting ?? ({} as NonNullable<RagConfig['toolRouting']>);
  if (data.maxTools !== undefined) toolRouting.maxTools = data.maxTools;
  if (data.topSemanticHits !== undefined) toolRouting.topSemanticHits = data.topSemanticHits;
  if (data.similarityThreshold !== undefined) toolRouting.similarityThreshold = data.similarityThreshold;
  if (data.fallbackOnRouterError !== undefined) toolRouting.fallbackOnRouterError = data.fallbackOnRouterError;
  if (data.fallbackOnNoMatch !== undefined) toolRouting.fallbackOnNoMatch = data.fallbackOnNoMatch;
  if (data.dependencies !== undefined) toolRouting.dependencies = data.dependencies;

  if (Object.keys(toolRouting).length > 0) {
    result.toolRouting = toolRouting;
  }

  return result;
}
