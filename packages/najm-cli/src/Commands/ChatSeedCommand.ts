import { intro, log, outro, text, confirm, select } from "@clack/prompts";
import pc from 'picocolors';

export class ChatSeedCommand {
  showHelp() {
    console.log(`
${pc.blue('NajmApi Chat Seed')}

${pc.yellow('USAGE:')}
  najm chat:seed [--help]

${pc.yellow('DESCRIPTION:')}
  Generates seed code for the singleton ai_settings row used by najm-chatbot.
  Defaults are optimized for local development with Ollama and llama3.1.

${pc.yellow('OPTIONS:')}
  ${pc.green('--help, -h')} Show this help message

${pc.yellow('EXAMPLES:')}
  najm chat:seed
  najm chat:seed --help
`);
  }

  async initialize() {
    intro(pc.blue('🤖 NajmApi Chat Seed'));

    const provider = await select({
      message: 'Select LLM provider for dev seed:',
      options: [
        { value: 'ollama', label: 'Ollama (local, no API key)', hint: 'llama3.1 on localhost:11434' },
        { value: 'openai', label: 'OpenAI', hint: 'requires OPENAI_API_KEY' },
        { value: 'anthropic', label: 'Anthropic', hint: 'requires ANTHROPIC_API_KEY' },
        { value: 'google', label: 'Google AI', hint: 'requires GOOGLE_API_KEY' },
        { value: 'zai', label: 'ZAI', hint: 'OpenAI-compatible endpoint' },
      ],
    });

    if (!provider || typeof provider === 'symbol') {
      log.error('No provider selected.');
      return;
    }

    const defaultModel: Record<string, string> = {
      ollama: 'llama3.1',
      openai: 'gpt-4o-mini',
      anthropic: 'claude-sonnet-4-20250514',
      google: 'gemini-2.0-flash',
      zai: 'default',
    };

    const defaultBaseUrl: Record<string, string> = {
      ollama: 'http://localhost:11434/v1',
      zai: '',
    };

    const model = await text({
      message: 'Model name:',
      placeholder: defaultModel[provider] ?? 'llama3.1',
    });

    const baseUrl = defaultBaseUrl[provider]
      ? await text({
          message: 'Base URL:',
          placeholder: defaultBaseUrl[provider],
        })
      : undefined;

    const enabled = await confirm({
      message: 'Enable chatbot?',
      initialValue: true,
    });

    const providerConfig: Record<string, string> = {
      ollama: 'ollama',
      openai: 'openai',
      anthropic: 'anthropic',
      google: 'google',
      zai: 'zai',
    };

    const seedCode = this.generateSeed(providerConfig[provider] ?? provider, String(model || defaultModel[provider]), baseUrl ? String(baseUrl) : undefined, !!enabled);

    log.info(pc.dim('Generated seed code:'));
    console.log('');
    console.log(pc.cyan(seedCode));
    console.log('');

    log.info(pc.dim('Paste the code above into your seed script (e.g., src/database/seed.ts) or run it directly with `bun eval`.'));
    log.info(pc.dim('If using Ollama, make sure it is running: `ollama serve && ollama pull llama3.1`'));

    outro(pc.green('✅ Chat seed generated!'));
  }

  private generateSeed(provider: string, model: string, baseUrl?: string, enabled = true): string {
    const result = [
      `import { drizzle } from 'drizzle-orm/bun-sqlite';`,
      `import { Database } from 'bun:sqlite';`,
      `import { eq } from 'drizzle-orm';`,
      `import { aiSettingsTable } from 'najm-chatbot/sqlite';`,
      '',
      `const sqlite = new Database(process.env.DATABASE_URL || './app.db');`,
      `const db = drizzle(sqlite);`,
      '',
      `await db.insert(aiSettingsTable).values({`,
      `  id: 'default',`,
      `  provider: '${provider}',`,
      `  model: '${model}',`,
      `  isEnabled: ${enabled},`,
      baseUrl ? `  baseUrl: '${baseUrl}',` : null,
      `}).onConflictDoUpdate({`,
      `  target: aiSettingsTable.id,`,
      `  set: {`,
      `    provider: '${provider}',`,
      `    model: '${model}',`,
      `    isEnabled: ${enabled},`,
      baseUrl ? `    baseUrl: '${baseUrl}',` : null,
      `    updatedAt: new Date().toISOString(),`,
      `  },`,
      `});`,
      '',
      `console.log('✅ AI settings seeded (${provider}/${model})');`,
    ].filter(Boolean).join('\n');

    return result;
  }
}
