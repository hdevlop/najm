import { intro, log, outro, text, confirm, select, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { Env } from 'dotenv-pro';
import { findProjectRoot } from '../utils/project';
import { shallowMergeRouting, mergeSemanticsItems } from '../utils/merge';

const CONFIG_DIR = 'src/server/config/chatbot';

export interface RagInitOptions {
  mode: string;
  baseUrl: string;
  model: string;
  maxTools?: number;
  addSamples: boolean;
}

export class RagInitCommand {
  showHelp() {
    console.log(`
${pc.blue('NajmApi RAG Init')}

${pc.yellow('USAGE:')}
  najm-api rag:init [--help]

${pc.yellow('DESCRIPTION:')}
  Scaffolds chatbot routing config, semantics, and test fixtures.
  Idempotent: re-running merges, never clobbers user edits.

${pc.yellow('OPTIONS:')}
  ${pc.green('--help, -h')} Show this help message

${pc.yellow('EXAMPLES:')}
  najm-api rag:init
  najm-api rag:init --help
`);
  }

  async initialize() {
    intro(pc.blue('🤖 NajmApi RAG Init'));

    // Prompts
    const dialect = await select({
      message: 'Database dialect:',
      options: [
        { value: 'sqlite', label: 'SQLite' },
        { value: 'pg', label: 'PostgreSQL' },
      ],
    });
    if (isCancel(dialect)) return;

    const baseUrl = await text({
      message: 'Ollama base URL:',
      placeholder: 'http://localhost:11434',
      initialValue: 'http://localhost:11434',
    });
    if (isCancel(baseUrl)) return;

    const model = await text({
      message: 'Embedding model:',
      placeholder: 'embeddinggemma',
      initialValue: 'embeddinggemma',
    });
    if (isCancel(model)) return;

    const mode = await select({
      message: 'Chatbot mode:',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'rag', label: 'RAG only' },
        { value: 'routing', label: 'RAG + Tool routing' },
      ],
      initialValue: 'routing',
    });
    if (isCancel(mode)) return;

    let maxTools: number | undefined;
    if (mode === 'routing') {
      const maxToolsInput = await text({
        message: 'Max tools per query:',
        placeholder: '12',
        initialValue: '12',
      });
      if (isCancel(maxToolsInput)) return;
      maxTools = parseInt(String(maxToolsInput), 10);
      if (isNaN(maxTools) || maxTools <= 0) maxTools = 12;
    }

    const addSamples = mode === 'routing' && (await confirm({
      message: 'Add sample semantics for demo?',
      initialValue: true,
    }));
    if (isCancel(addSamples)) return;

    await this.run({
      mode: mode as string,
      baseUrl: String(baseUrl),
      model: String(model),
      maxTools,
      addSamples: !!addSamples,
    });

    outro(pc.green('✅ RAG init complete!'));
  }

  async run(options: RagInitOptions) {
    const root = findProjectRoot();
    const configDir = resolve(root, CONFIG_DIR);

    // Ensure config dir exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Generate / merge routing.json
    const routingPath = join(configDir, 'routing.json');
    const newRouting = this.buildRoutingJson(options);
    this.writeJsonMerged(routingPath, newRouting, shallowMergeRouting);

    // Generate / merge semantics.json
    const semanticsPath = join(configDir, 'semantics.json');
    const newSemantics = options.addSamples ? this.buildSampleSemantics() : { items: [] };
    this.writeSemanticsMerged(semanticsPath, newSemantics);

    // Generate routing-test-cases.json if missing
    const testCasesPath = join(configDir, 'routing-test-cases.json');
    const testCasesExisted = existsSync(testCasesPath);
    if (!testCasesExisted) {
      writeFileSync(testCasesPath, JSON.stringify({ cases: [] }, null, 2) + '\n', 'utf-8');
      log.info(pc.dim(`Created ${CONFIG_DIR}/routing-test-cases.json`));
    }

    // Patch .env
    const envKeys: Record<string, string> = {};
    envKeys.OLLAMA_BASE_URL = options.baseUrl;
    envKeys.CHATBOT_ROUTING_CONFIG_PATH = `${CONFIG_DIR}/routing.json`;

    this.patchEnv(resolve(root, '.env'), envKeys);
    this.patchEnv(resolve(root, '.env.example'), envKeys, true);

    log.info(pc.dim(''));
    log.info(pc.cyan('Next steps:'));
    log.info(pc.dim('  1. Spread chatbotSchema in your Drizzle schema (najm-chatbot/sqlite or /pg)'));
    log.info(pc.dim('  2. Run your normal Drizzle generate/migrate'));
    log.info(pc.dim(`  3. Wire chatbot({ configPath: '${CONFIG_DIR}/routing.json' }) into your plugin setup`));
    log.info(pc.dim('  4. Make sure Ollama is running and the embedding model is pulled'));
    log.info(pc.dim('  5. Run \`najm-cli rag:scan\` to fill semantics from your controllers'));
  }

  private buildRoutingJson(opts: { mode: string; baseUrl: string; model: string; maxTools?: number }): Record<string, any> {
    const result: Record<string, any> = {
      mode: opts.mode,
      embedding: {
        baseUrl: opts.baseUrl,
        model: opts.model,
      },
      similarityThreshold: 0.45,
      indexOnBoot: true,
      chatLogging: true,
    };
    if (opts.maxTools !== undefined) {
      result.maxTools = opts.maxTools;
    }
    return result;
  }

  private buildSampleSemantics(): { items: Array<{ toolName: string; phrases: Array<{ lang: string; phrase: string }> }> } {
    return {
      items: [
        {
          toolName: 'products_get_all',
          phrases: [
            { lang: 'en', phrase: 'list all products' },
            { lang: 'fr', phrase: 'liste tous les produits' },
            { lang: 'ary', phrase: 'ورد لائحة المنتجات' },
          ],
        },
        {
          toolName: 'orders_list_for_user',
          phrases: [
            { lang: 'en', phrase: 'show my orders' },
            { lang: 'fr', phrase: 'montre mes commandes' },
            { lang: 'ary', phrase: 'وريني الطلبيات ديالي' },
          ],
        },
      ],
    };
  }

  private writeJsonMerged(path: string, defaults: Record<string, any>, mergeFn: (t: any, s: any) => any) {
    const existed = existsSync(path);
    let existing: Record<string, any> = {};
    if (existed) {
      try {
        existing = JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        throw new Error(`Invalid existing JSON: ${path}`);
      }
    }
    const merged = mergeFn(existing, defaults);
    const out = JSON.stringify(merged, null, 2) + '\n';
    writeFileSync(path, out, 'utf-8');
    log.info(pc.dim(`${existed ? 'Updated' : 'Created'} ${path.replace(resolve(findProjectRoot()), '.')}`));
  }

  private writeSemanticsMerged(path: string, defaults: { items: Array<any> }) {
    const existed = existsSync(path);
    let existing: { items: Array<any> } = { items: [] };
    if (existed) {
      try {
        existing = JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        throw new Error(`Invalid existing JSON: ${path}`);
      }
    }
    const merged = mergeSemanticsItems(existing.items, defaults.items);
    const out = JSON.stringify({ items: merged }, null, 2) + '\n';
    writeFileSync(path, out, 'utf-8');
    log.info(pc.dim(`${existed ? 'Updated' : 'Created'} ${path.replace(resolve(findProjectRoot()), '.')}`));
  }

  private patchEnv(path: string, keys: Record<string, string>, placeholder = false) {
    const values = placeholder
      ? Object.fromEntries(Object.entries(keys).map(([k]) => [k, k === 'OLLAMA_BASE_URL' ? 'http://localhost:11434' : `${CONFIG_DIR}/routing.json`]))
      : keys;

    const env = Env({ path });
    let changed = false;
    for (const [key, value] of Object.entries(values)) {
      if (!env.has(key)) {
        env.add(key, value);
        changed = true;
      }
    }
    if (changed) {
      env.save();
      log.info(pc.dim(`Patched ${path.replace(resolve(findProjectRoot()), '.')}`));
    }
  }
}
