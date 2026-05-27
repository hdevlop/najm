import { intro, log, outro, text, confirm, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { findProjectRoot } from '../utils/project';
import { mergeSemanticsItems } from '../utils/merge';

const CONFIG_DIR = 'src/server/config/chatbot';

export interface ScannedTool {
  name: string;
  group?: string;
  description: string;
  destructive?: boolean;
  httpMethod?: string;
  routePath?: string;
  controllerPath?: string;
  fullPath?: string;
}

interface HeuristicNote {
  field: string;
  tool: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export class RagScanCommand {
  private dryRun = false;
  private prune = false;
  private notes: HeuristicNote[] = [];

  showHelp() {
    console.log(`
${pc.blue('NajmApi RAG Scan')}

${pc.yellow('USAGE:')}
  najm-api rag:scan [--prune] [--dry-run] [--help]

${pc.yellow('DESCRIPTION:')}
  Scans controllers for @McpTool methods and auto-fills semantics.json
  and routing.json heuristic fields.

${pc.yellow('OPTIONS:')}
  ${pc.green('--prune')}     Remove semantics entries whose toolName no longer exists
  ${pc.green('--dry-run')}   Print diff, do not write files
  ${pc.green('--help, -h')}  Show this help message

${pc.yellow('EXAMPLES:')}
  najm-api rag:scan
  najm-api rag:scan --dry-run
  najm-api rag:scan --prune
`);
  }

  async initialize(args: string[]) {
    this.dryRun = args.includes('--dry-run');
    this.prune = args.includes('--prune');

    intro(pc.blue('🔍 NajmApi RAG Scan'));

    const root = findProjectRoot();
    const configDir = resolve(root, CONFIG_DIR);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    const entrypoint = await this.detectEntrypoint(root);
    if (!entrypoint) {
      log.error('Could not detect server entrypoint. Pass --entry <path> or ensure src/server/index.ts exists.');
      process.exit(1);
    }

    const tools = await this.scanTools(entrypoint);

    if (tools.length === 0) {
      outro(pc.yellow('No @McpTool methods found.'));
      return;
    }

    log.info(pc.dim(`Found ${tools.length} @McpTool methods${tools.some(t => t.group) ? ` in ${new Set(tools.map(t => t.group).filter(Boolean)).size} groups` : ''}`));

    await this.run(tools);

    outro(pc.green('✅ RAG scan complete!'));
  }

  async run(tools: ScannedTool[]) {
    const root = findProjectRoot();
    const configDir = resolve(root, CONFIG_DIR);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    const semanticsPath = join(configDir, 'semantics.json');
    const routingPath = join(configDir, 'routing.json');
    const sidecarPath = join(configDir, 'routing.json.scan-notes.md');

    this.notes = [];
    const semanticsReport = this.updateSemantics(semanticsPath, tools);
    const routingReport = this.updateRouting(routingPath, tools);
    this.updateSidecarNotes(sidecarPath);

    log.info(pc.dim(''));
    log.info(pc.cyan('📝 semantics.json'));
    log.info(pc.dim(`   • added: ${semanticsReport.added.length > 0 ? semanticsReport.added.join(', ') : 'none'} (+${semanticsReport.added.length})`));
    log.info(pc.dim(`   • preserved: ${semanticsReport.preserved} user-edited entries`));
    log.info(pc.dim(`   • removed: ${semanticsReport.removed} ${this.prune ? '(pruned)' : '(use --prune to remove stale entries)'}`));

    log.info(pc.dim(''));
    log.info(pc.cyan('📝 routing.json'));
    log.info(pc.dim(`   • dependencies: ${routingReport.dependenciesCount} inferred from route hierarchy`));

    if (this.notes.length > 0) {
      log.info(pc.dim(''));
      log.info(pc.cyan('📝 routing.json.scan-notes.md'));
      log.info(pc.dim(`   • ${this.notes.length} heuristic notes written`));
      const todoCount = this.notes.filter(n => n.confidence !== 'high').length;
      if (todoCount > 0) {
        log.warn(pc.yellow(`   ⚠ ${todoCount} entries marked TODO — review heuristic guesses in routing.json.scan-notes.md`));
      }
    }
  }

  private async detectEntrypoint(root: string): Promise<string | null> {
    const candidates = [
      'src/server/index.ts',
      'src/main.ts',
      'src/index.ts',
      'server/index.ts',
      'main.ts',
    ];
    for (const c of candidates) {
      const p = resolve(root, c);
      if (existsSync(p)) return p;
    }
    return null;
  }

  private async scanTools(entrypoint: string): Promise<ScannedTool[]> {
    const originalCwd = process.cwd();
    process.chdir(dirname(entrypoint));

    try {
      const mod = await import(entrypoint);
      const server = mod.server ?? mod.default;
      if (!server || typeof server.init !== 'function') {
        throw new Error(`Entrypoint does not export a Server instance with .init(): ${entrypoint}`);
      }

      await server.init();

      const { McpRegistryService } = await import('najm-mcp');
      const registry = server.container.get(McpRegistryService);

      let getRoutes: ((target: any) => Array<{ method: string; path: string; methodName: string }>) = () => [];
      let getPath: ((target: any) => string | undefined) = () => undefined;

      try {
        const core = await import('najm-core');
        getRoutes = core.getRoutes ?? getRoutes;
        getPath = core.getPath ?? getPath;
      } catch {
        // najm-core not available — route metadata won't be enriched
      }

      return (registry.tools ?? []).map((t: any) => {
        const routes = getRoutes(t.target);
        const route = routes.find((r: any) => r.methodName === t.methodKey);
        const controllerPath = getPath(t.target) ?? '';

        return {
          name: t.name,
          group: t.group,
          description: t.description ?? '',
          destructive: t.annotations?.destructive ?? false,
          httpMethod: route?.method,
          routePath: route?.path,
          controllerPath,
          fullPath: route ? `${controllerPath}${route.path}` : undefined,
        };
      });
    } finally {
      process.chdir(originalCwd);
    }
  }

  private updateSemantics(path: string, tools: ScannedTool[]) {
    let existing: { items: Array<{ toolName: string; phrases: Array<{ lang?: string; phrase: string }> }> } = { items: [] };
    if (existsSync(path)) {
      try {
        existing = JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        throw new Error(`Invalid existing JSON: ${path}`);
      }
    }

    const toolNames = new Set(tools.map(t => t.name));
    const added: string[] = [];
    const newItems: typeof existing.items = [];

    for (const tool of tools) {
      const existingItem = existing.items.find(i => i.toolName === tool.name);
      if (!existingItem) {
        added.push(tool.name);
        newItems.push({
          toolName: tool.name,
          phrases: [{ lang: 'en', phrase: tool.description }],
        });
      } else {
        const hasEn = existingItem.phrases.some(p => (p.lang ?? 'en') === 'en');
        if (!hasEn && tool.description) {
          added.push(`${tool.name} (en phrase)`);
          existingItem.phrases.push({ lang: 'en', phrase: tool.description });
        }
      }
    }

    let removed = 0;
    let preserved = 0;
    const finalItems = existing.items.filter(item => {
      if (toolNames.has(item.toolName)) return true;
      preserved++;
      if (this.prune) {
        removed++;
        return false;
      }
      return true;
    });

    const merged = mergeSemanticsItems(finalItems, newItems);

    if (!this.dryRun) {
      writeFileSync(path, JSON.stringify({ items: merged }, null, 2) + '\n', 'utf-8');
    }

    return { added, removed, preserved: preserved - removed };
  }

  private updateRouting(path: string, tools: ScannedTool[]) {
    let existing: Record<string, any> = {};
    if (existsSync(path)) {
      try {
        existing = JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        throw new Error(`Invalid existing JSON: ${path}`);
      }
    }

    const dependencies: Record<string, string[]> = { ...(existing.dependencies ?? {}) };

    const groups = new Map<string, ScannedTool[]>();
    for (const tool of tools) {
      const group = tool.group ?? 'default';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(tool);
    }

    this.deriveDependencies(tools, groups, dependencies, existing);

    const existingWithoutCoreTools = { ...existing };
    delete existingWithoutCoreTools[['core', 'Tools', 'By', 'Group'].join('')];
    delete existingWithoutCoreTools.dangerousIntentKeywords;
    const merged = {
      ...existingWithoutCoreTools,
      dependencies,
    };

    if (!this.dryRun) {
      writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    }

    return {
      dependenciesCount: Object.keys(dependencies).length,
    };
  }

  private deriveDependencies(
    tools: ScannedTool[],
    groups: Map<string, ScannedTool[]>,
    dependencies: Record<string, string[]>,
    existing: Record<string, any>,
  ) {
    const existingDeps: Record<string, string[]> = existing.dependencies ?? {};

    for (const [group, groupTools] of groups) {
      const withPaths = groupTools.filter(t => t.fullPath && t.httpMethod === 'get');
      if (withPaths.length < 2) continue;

      const normalized = withPaths.map(t => ({
        tool: t,
        segments: this.normalizePath(t.fullPath!),
      }));

      normalized.sort((a, b) => a.segments.length - b.segments.length);

      for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
          const shorter = normalized[i];
          const longer = normalized[j];

          if (this.isPathPrefix(shorter.segments, longer.segments)) {
            if (existingDeps[longer.tool.name] && existingDeps[longer.tool.name].length > 0) continue;
            if (dependencies[longer.tool.name] && dependencies[longer.tool.name].length > 0) continue;

            dependencies[longer.tool.name] = [shorter.tool.name];
            this.notes.push({
              field: 'dependencies',
              tool: longer.tool.name,
              reason: `${longer.tool.fullPath} extends ${shorter.tool.fullPath} → depends on ${shorter.tool.name}`,
              confidence: 'medium',
            });
          }
        }
      }
    }
  }

  private normalizePath(path: string): string[] {
    return path
      .split('/')
      .filter(Boolean)
      .map(seg => (seg.startsWith(':') ? ':param' : seg.toLowerCase()));
  }

  private isPathPrefix(shorter: string[], longer: string[]): boolean {
    if (shorter.length >= longer.length) return false;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] !== longer[i]) return false;
    }
    return true;
  }

  private updateSidecarNotes(path: string) {
    if (this.notes.length === 0) return;

    const lines: string[] = [
      '# Routing Heuristic Notes',
      '',
      `> Auto-generated by \`najm-cli rag:scan\` on ${new Date().toISOString().split('T')[0]}.`,
      '> Review entries marked **TODO** and adjust routing.json as needed.',
      '',
    ];

    const byField = new Map<string, HeuristicNote[]>();
    for (const note of this.notes) {
      if (!byField.has(note.field)) byField.set(note.field, []);
      byField.get(note.field)!.push(note);
    }

    for (const [field, notes] of byField) {
      lines.push(`## ${field}`);
      lines.push('');
      for (const n of notes) {
        const tag = n.confidence === 'high'
          ? '✅'
          : n.confidence === 'medium'
            ? '⚠️ TODO'
            : '❓ TODO';
        lines.push(`- ${tag} \`${n.tool}\` — ${n.reason}`);
      }
      lines.push('');
    }

    if (!this.dryRun) {
      writeFileSync(path, lines.join('\n') + '\n', 'utf-8');
    }
  }
}
