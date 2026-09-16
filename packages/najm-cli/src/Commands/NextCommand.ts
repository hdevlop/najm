import { confirm, intro, log, outro, select, text } from '@clack/prompts';
import { installPackages } from 'pm-ninja';
import path from 'path';
import pc from 'picocolors';

import {
  applyNextIntegrationPlan,
  createNextIntegrationPlan,
  previewNextIntegrationPlan,
  type NextIntegrationPlan,
  type NextLocationChoice,
  PROTECTED_LAYOUT_TEMPLATE,
} from '../nextIntegration';

export class NextCommand {
  private basePath = 'src/server';
  private packageManager = 'bun';
  private withAuth = false;
  private withTheme = false;
  private location: NextLocationChoice = 'disabled';
  private plan: NextIntegrationPlan | null = null;

  async initialize() {
    try {
      intro(pc.blue('Najm Next application integration'));
      await this.promptBasePath();
      await this.promptAuth();
      await this.promptTheme();
      await this.promptLocation();
      await this.promptPKManager();
      const applied = await this.buildProject();
      if (!applied) {
        outro(pc.yellow('Preview complete; no files or dependencies changed.'));
        return;
      }
      await this.addPackages();
      if (this.withAuth) this.explainAuth();
      outro(pc.green('Najm Next integration initialized.'));
    } catch (error) {
      throw error;
    }
  }

  async promptPKManager() {
    this.packageManager = await select({
      message: 'Which package manager would you like to use?',
      options: [
        { value: 'bun', label: 'bun' },
        { value: 'npm', label: 'npm' },
        { value: 'yarn', label: 'yarn' },
        { value: 'pnpm', label: 'pnpm' },
      ],
    }) as string;
  }

  async promptAuth() {
    this.withAuth = await confirm({
      message: 'Enable Najm Auth?',
      initialValue: true,
    }) as boolean;
  }

  async promptTheme() {
    this.withTheme = await confirm({
      message: 'Enable Najm Kit and Theme providers?',
      initialValue: true,
    }) as boolean;
  }

  async promptLocation() {
    this.location = await select({
      message: 'Choose a location runtime:',
      options: [
        { value: 'disabled', label: 'Disabled (no map SDK)' },
        { value: 'leaflet', label: 'Leaflet' },
        { value: 'google', label: 'Google Maps' },
      ],
    }) as NextLocationChoice;
  }

  async promptBasePath() {
    this.basePath = await text({
      message: 'Enter server path (default: src/server):',
      placeholder: 'src/server',
      initialValue: 'src/server',
    }) as string;
  }

  async buildProject() {
    const directoryName = path.basename(process.cwd())
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'najm-app';
    const appId = /^[a-z]/.test(directoryName) ? directoryName : `app-${directoryName}`;
    this.plan = createNextIntegrationPlan({
      appId,
      basePath: this.basePath,
      auth: this.withAuth,
      theme: this.withTheme,
      location: this.location,
    });

    const preview = await previewNextIntegrationPlan(process.cwd(), this.plan);
    for (const entry of preview) log.info(`${entry.status.padEnd(9)} ${entry.path}`);
    if (preview.some((entry) => entry.status === 'conflict')) {
      throw new Error('Resolve the listed conflicts first; no generated file was changed.');
    }

    const shouldApply = await confirm({
      message: 'Apply this non-destructive plan and install its dependencies?',
      initialValue: true,
    }) as boolean;
    if (!shouldApply) return false;
    await applyNextIntegrationPlan(process.cwd(), this.plan);
    return true;
  }

  async addPackages() {
    if (!this.plan) throw new Error('Integration plan was not created');
    await installPackages({
      dependencies: [...this.plan.dependencies],
      devDependencies: [...this.plan.devDependencies],
    }, {
      cwd: process.cwd(),
      pm: this.packageManager,
    });
  }

  explainAuth() {
    log.info('Auth boundary created. Keep lib/auth.ts shared-safe and najm.server.ts server-only.');
    log.info(`Guard a protected segment like this:\n\n${PROTECTED_LAYOUT_TEMPLATE}`);
  }
}
