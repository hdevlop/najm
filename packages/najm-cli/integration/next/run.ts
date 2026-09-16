import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import {
  applyNextIntegrationPlan,
  createNextIntegrationPlan,
  type NextIntegrationOptions,
} from '../../src/nextIntegration';

const allProfiles: Array<NextIntegrationOptions & { name: string }> = [
  { name: 'minimal', appId: 'minimal-app', auth: false, theme: false, location: 'disabled' },
  { name: 'leaflet', appId: 'leaflet-app', auth: true, theme: true, location: 'leaflet' },
  { name: 'google', appId: 'google-app', auth: true, theme: true, location: 'google' },
];

const requestedProfile = process.env.NAJM_NEXT_FIXTURE_PROFILE?.trim();
const profiles = requestedProfile
  ? allProfiles.filter(({ name }) => name === requestedProfile)
  : allProfiles;
if (profiles.length === 0) {
  throw new TypeError(`Unknown NAJM_NEXT_FIXTURE_PROFILE: ${requestedProfile}`);
}

function localPackageSpec(value: string | undefined): string | undefined {
  const spec = value?.trim();
  if (!spec) return undefined;
  if (spec.startsWith('file:')) return spec;
  return `file:${path.resolve(spec).replace(/\\/g, '/')}`;
}

const candidatePackages = {
  'najm-next': localPackageSpec(process.env.NAJM_NEXT_PACKAGE_SPEC),
  'najm-kit': localPackageSpec(process.env.NAJM_KIT_PACKAGE_SPEC),
};

function dependencyRecord(specs: readonly string[]): Record<string, string> {
  return Object.fromEntries(specs.map((spec) => {
    const separator = spec.lastIndexOf('@');
    if (separator <= 0) return [spec, 'latest'];
    return [spec.slice(0, separator), spec.slice(separator + 1)];
  }));
}

function dependencyRecordWithCandidates(specs: readonly string[]): Record<string, string> {
  const dependencies = dependencyRecord(specs);
  for (const [name, candidate] of Object.entries(candidatePackages)) {
    if (candidate && name in dependencies) dependencies[name] = candidate;
  }
  return dependencies;
}

async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${command.join(' ')} failed for ${cwd} with exit ${exitCode}`);
}

const root = await mkdtemp(path.join(tmpdir(), 'najm-cli-next16-'));
try {
  for (const profile of profiles) {
    const project = path.join(root, profile.name);
    const plan = createNextIntegrationPlan(profile);
    await applyNextIntegrationPlan(project, plan);
    await writeFile(path.join(project, 'package.json'), JSON.stringify({
      name: `najm-cli-${profile.name}-fixture`,
      private: true,
      type: 'module',
      scripts: { build: 'next build --webpack' },
      dependencies: {
        ...dependencyRecordWithCandidates(plan.dependencies),
        next: '16.2.11',
        react: '19.2.4',
        'react-dom': '19.2.4',
      },
      devDependencies: dependencyRecord(plan.devDependencies),
    }, null, 2) + '\n');
    await writeFile(path.join(project, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] },
      },
      include: ['next-env.d.ts', '.next/types/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['node_modules'],
    }, null, 2) + '\n');
    await writeFile(path.join(project, 'next-env.d.ts'), [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      '',
    ].join('\n'));

    const source = Object.values(candidatePackages).some(Boolean) ? 'candidate-pack' : 'registry';
    console.log(`\n[najm-cli] installing ${profile.name} ${source} fixture`);
    const installCommand = ['bun', 'install'];
    if (process.env.NAJM_NEXT_FIXTURE_OFFLINE === '1') installCommand.push('--offline');
    await run(installCommand, project);
    console.log(`[najm-cli] building ${profile.name} ${source} fixture`);
    await run(['bun', 'run', 'build'], project);
  }
  const source = Object.values(candidatePackages).some(Boolean) ? 'candidate-pack' : 'registry';
  console.log(`\n[najm-cli] generated Next 16 ${source} fixtures PASS`);
} finally {
  await rm(root, { recursive: true, force: true });
}
