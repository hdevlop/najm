import 'reflect-metadata';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { Server } from 'najm-api';
import { ChatbotRagController } from 'najm-rag';
import {
  databaseConfig,
  authConfig,
  corsConfig,
  i18nConfig,
  eventsConfig,
  mcpConfig,
  validationConfig,
  rateLimitConfig,
  chatbotConfig,
} from '../src/server/config/plugins';

import * as modulesModule from '../src/server/modules';

const phraseSchema = z.object({
  lang: z.string().optional(),
  phrase: z.string(),
});

const itemSchema = z.object({
  toolName: z.string(),
  phrases: z.array(phraseSchema),
});

const semanticsSchema = z.object({
  items: z.array(itemSchema),
});

async function importViaHttp(url: string, items: unknown[]) {
  console.error(
    `HTTP import via ${url} is not yet implemented. ` +
      'Remove CHATBOT_SEMANTICS_REMOTE_URL to use the default in-process import instead.',
  );
  process.exit(1);
}

async function importInProcess(items: z.infer<typeof itemSchema>[]) {
  // Minimal plugin set: only what the chatbot RAG controller needs
  const server = new Server({ isolated: true })
    .use(corsConfig())
    .use(databaseConfig())
    .use(i18nConfig())
    .use(validationConfig())
    .use(eventsConfig())
    .use(rateLimitConfig())
    .use(mcpConfig())
    .use(authConfig())
    .use(chatbotConfig())
    .base('/api')
    .load(modulesModule);

  await server.listen(0);

  try {
    const controller = await server.container.resolve(ChatbotRagController);
    const result = await controller.importSemantics({ items });

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const r of result.results) {
      if (r.status === 'inserted') inserted++;
      else if (r.status === 'updated') updated++;
      else skipped++;
    }

    console.log(`Semantics import complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);

    if (result.results.some((r: any) => r.error)) {
      const errors = result.results.filter((r: any) => r.error);
      console.error(`\n${errors.length} errors:`);
      for (const e of errors.slice(0, 10)) {
        console.error(`  - ${e.toolName} / "${e.phrase}": ${e.error}`);
      }
      if (errors.length > 10) {
        console.error(`  ... and ${errors.length - 10} more`);
      }
    }
  } finally {
    await server.stop();
  }
}

async function main() {
  const envPath = process.env.CHATBOT_SEMANTICS_PATH;
  const defaultPath = resolve(import.meta.dirname, '../src/server/config/chatbot/semantics.json');
  const semanticsPath = envPath ? resolve(envPath) : defaultPath;

  if (!existsSync(semanticsPath)) {
    console.error(`Semantics file not found: ${semanticsPath}`);
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(semanticsPath, 'utf-8');
  } catch (error) {
    console.error(`Failed to read semantics file (${semanticsPath}):`, error);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`Invalid JSON in semantics file (${semanticsPath}):`, error);
    process.exit(1);
  }

  const validation = semanticsSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    console.error(`Semantics validation failed: ${issues}`);
    process.exit(1);
  }

  const remoteUrl = process.env.CHATBOT_SEMANTICS_REMOTE_URL;
  if (remoteUrl) {
    await importViaHttp(remoteUrl, validation.data.items);
  } else {
    await importInProcess(validation.data.items);
  }
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
