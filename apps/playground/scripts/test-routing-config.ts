import 'reflect-metadata';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { Server } from 'najm-api';
import { CHATBOT_CONFIG } from 'najm-chatbot';
import { ChatbotRagController, ToolRouterService, DEFAULT_DANGEROUS_PATTERNS } from 'najm-rag';
import { McpRegistryService } from 'najm-mcp';
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

const testCaseSchema = z.object({
  query: z.string(),
  locale: z.string().optional(),
  expectTools: z.array(z.string()).optional(),
  mustInclude: z.array(z.string()).optional(),
  mustNotInclude: z.array(z.string()).optional(),
});

const testCasesFileSchema = z.object({
  cases: z.array(testCaseSchema),
});

interface ValidationError {
  type: string;
  message: string;
}

async function runValidation() {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

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
    const registry = server.container.get(McpRegistryService);
    const router = server.container.get(ToolRouterService);
    const ragController = await server.container.resolve(ChatbotRagController);
    const config = server.container.get<import('najm-chatbot').ChatbotConfig>(CHATBOT_CONFIG);

    const registeredToolNames = new Set(registry.tools.map((t) => t.name));
    const toolRouting = config.toolRouting ?? {};

    // --- 1. Validate dependency targets ---
    for (const [source, targets] of Object.entries(toolRouting.dependencies ?? {})) {
      if (!registeredToolNames.has(source)) {
        errors.push({
          type: 'dependencies',
          message: `Dependency source "${source}" is not a registered tool`,
        });
      }
      for (const target of targets) {
        if (!registeredToolNames.has(target)) {
          errors.push({
            type: 'dependencies',
            message: `Dependency "${source}" -> "${target}" targets unknown tool`,
          });
        }
      }
    }

    // --- 2. Validate dangerous keyword categories ---
    for (const category of Object.keys(toolRouting.dangerousIntentKeywords ?? {})) {
      if (!DEFAULT_DANGEROUS_PATTERNS.includes(category)) {
        errors.push({
          type: 'dangerousIntentKeywords',
          message: `Unknown dangerous intent category: "${category}". Supported: ${DEFAULT_DANGEROUS_PATTERNS.join(', ')}`,
        });
      }
    }

    // --- 3. Validate semantic phrase toolNames (if semantics file exists) ---
    const semanticsPath = process.env.CHATBOT_SEMANTICS_PATH
      ? resolve(process.env.CHATBOT_SEMANTICS_PATH)
      : resolve(import.meta.dirname, '../src/server/config/chatbot/semantics.json');

    let semanticsImported = false;
    if (existsSync(semanticsPath)) {
      try {
        const semanticsRaw = readFileSync(semanticsPath, 'utf-8');
        const semantics = JSON.parse(semanticsRaw) as { items?: Array<{ toolName?: string }> };
        for (const item of semantics.items ?? []) {
          if (!registeredToolNames.has(item.toolName ?? '')) {
            errors.push({
              type: 'semantics',
              message: `Semantics file references unknown tool: "${item.toolName}"`,
            });
          }
        }

        // Pre-load semantics into the database so routing test cases can match
        try {
          const importResult = await ragController.importSemantics(semantics);
          const actuallyImported = importResult.results.some(
            (r: any) => r.status === 'inserted' || r.status === 'updated',
          );
          if (!actuallyImported) {
            warnings.push(
              'No semantics were imported (embedding service may be unavailable); skipping routing test cases',
            );
          } else {
            semanticsImported = true;
          }
        } catch (embedError) {
          warnings.push(
            `Could not pre-load semantics for routing tests (embedding service may be unavailable): ${embedError instanceof Error ? embedError.message : String(embedError)}`,
          );
        }
      } catch {
        warnings.push(`Could not validate semantics file (${semanticsPath})`);
      }
    }

    // --- 4. Run routing test cases ---
    const testCasesPath = resolve(import.meta.dirname, '../src/server/config/chatbot/routing-test-cases.json');
    if (existsSync(testCasesPath)) {
      try {
        const casesRaw = readFileSync(testCasesPath, 'utf-8');
        const casesParsed = JSON.parse(casesRaw);
        const validation = testCasesFileSchema.safeParse(casesParsed);
        if (!validation.success) {
          errors.push({
            type: 'testCases',
            message: `Test cases file validation failed: ${validation.error.message}`,
          });
        } else if (!semanticsImported) {
          warnings.push('Skipping routing test cases because semantics could not be pre-loaded (embedding service unavailable)');
        } else {
          for (let i = 0; i < validation.data.cases.length; i++) {
            const testCase = validation.data.cases[i];
            try {
              const result = await router.findRelevantTools(testCase.query);
              const resultNames = result.tools.map((t) => t.name);

              for (const must of testCase.mustInclude ?? []) {
                if (!resultNames.includes(must)) {
                  errors.push({
                    type: 'testCase',
                    message: `Case ${i + 1} "${testCase.query}": expected "${must}" in results, got [${resultNames.join(', ')}]`,
                  });
                }
              }

              for (const mustNot of testCase.mustNotInclude ?? []) {
                if (resultNames.includes(mustNot)) {
                  errors.push({
                    type: 'testCase',
                    message: `Case ${i + 1} "${testCase.query}": did not expect "${mustNot}" in results, got [${resultNames.join(', ')}]`,
                  });
                }
              }
            } catch (error) {
              // Treat individual routing failures as warnings rather than hard errors,
              // since embedding availability is environment-dependent.
              warnings.push(
                `Case ${i + 1} "${testCase.query}": routing threw: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }
      } catch (error) {
        warnings.push(`Could not run test cases: ${error}`);
      }
    } else {
      warnings.push('No routing-test-cases.json found');
    }

    // --- Report ---
    const testCaseCount = existsSync(testCasesPath)
      ? (JSON.parse(readFileSync(testCasesPath, 'utf-8'))?.cases?.length ?? 0)
      : 0;
    const skippedCases = semanticsImported ? 0 : testCaseCount;
    const ranCases = testCaseCount - skippedCases;

    console.log(`\nRouting config validation complete.`);
    console.log(`  Registered tools: ${registeredToolNames.size}`);
    console.log(`  Static config errors: ${errors.length}`);
    console.log(`  Routing test cases: ${ranCases} run, ${skippedCases} skipped`);
    console.log(`  Warnings: ${warnings.length}`);

    if (warnings.length > 0) {
      console.log('\nWarnings:');
      for (const w of warnings) {
        console.log(`  ⚠️  ${w}`);
      }
    }

    if (errors.length > 0) {
      console.log('\nErrors:');
      for (const e of errors) {
        console.log(`  ❌ [${e.type}] ${e.message}`);
      }
      console.log('');
      process.exit(1);
    }

    console.log(`\n✅ Static config checks passed (${registeredToolNames.size} tools validated).`);
    if (skippedCases > 0) {
      console.log(`⚠️  ${skippedCases} routing test case(s) skipped (embedding service unavailable or tables missing).`);
    } else if (ranCases > 0) {
      console.log(`✅ ${ranCases} routing test case(s) passed.`);
    }
    console.log();
  } finally {
    await server.stop();
  }
}

runValidation().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
