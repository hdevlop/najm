#!/usr/bin/env bun

import { join } from 'node:path';
import { PACKAGE_TARGETS, type PackageTarget } from './workspaces.ts';

type BumpType = 'patch' | 'minor' | 'major';

type CliOptions = {
  dryRun: boolean;
  from?: string;
  tag?: string;
  otp?: string;
  access?: 'public' | 'restricted';
  skipWhoami: boolean;
  bump?: BumpType;
};

type PackageJson = {
  name?: string;
  version?: string;
  main?: string;
  types?: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  publishConfig?: Record<string, unknown>;
  [key: string]: unknown;
};

const PUBLISH_OVERRIDE_KEYS = ['main', 'types', 'exports'] as const;
const PUBLISH_ORDER: PackageTarget[] = PACKAGE_TARGETS;

function printUsage(): void {
  console.log('Usage: bun scripts/publish-all.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run                Run npm publish in dry-run mode');
  console.log('  --from <name|workspace>  Start publishing from this package');
  console.log('  --tag <tag>              Publish with npm dist-tag');
  console.log('  --otp <code>             Provide npm 2FA one-time password');
  console.log('  --access <mode>          Access level: public or restricted');
  console.log('  --skip-whoami            Skip npm whoami precheck');
  console.log('  --patch                  Bump patch version before publishing');
  console.log('  --minor                  Bump minor version before publishing');
  console.log('  --major                  Bump major version before publishing');
  console.log('  --help                   Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  bun scripts/publish-all.ts --dry-run');
  console.log('  bun scripts/publish-all.ts --from najm-rate');
  console.log('  bun scripts/publish-all.ts --tag next');
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    skipWhoami: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--skip-whoami') {
      options.skipWhoami = true;
      continue;
    }

    if (arg === '--patch') {
      options.bump = 'patch';
      continue;
    }

    if (arg === '--minor') {
      options.bump = 'minor';
      continue;
    }

    if (arg === '--major') {
      options.bump = 'major';
      continue;
    }

    if (arg === '--from') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --from');
      }
      options.from = value;
      index += 1;
      continue;
    }

    if (arg === '--tag') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --tag');
      }
      options.tag = value;
      index += 1;
      continue;
    }

    if (arg === '--otp') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --otp');
      }
      options.otp = value;
      index += 1;
      continue;
    }

    if (arg === '--access') {
      const access = argv[index + 1];
      if (!access) {
        throw new Error('Missing value for --access');
      }
      if (access !== 'public' && access !== 'restricted') {
        throw new Error(`Invalid --access value: ${access}`);
      }
      options.access = access;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function resolveStartIndex(from: string | undefined, targets: PackageTarget[]): number {
  if (!from) {
    return 0;
  }

  const normalized = from.trim();
  const index = targets.findIndex((target) =>
    target.name === normalized || target.workspace === normalized,
  );

  if (index === -1) {
    throw new Error(`Package not found for --from: ${from}`);
  }

  return index;
}

async function runCommand(command: string[], label: string): Promise<void> {
  console.log(`\n${label}`);
  const child = Bun.spawn(command, {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await child.exited;

  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
}

// -----------------------------------------------------------------
// workspace:* resolution helpers
// -----------------------------------------------------------------

/** Build a map of { packageName -> version } for every package in PUBLISH_ORDER. */
async function buildVersionMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const target of PUBLISH_ORDER) {
    const pkgPath = join(target.workspace, 'package.json');
    const file = Bun.file(pkgPath);
    if (!(await file.exists())) {
      throw new Error(`package.json not found for ${target.name}: ${pkgPath}`);
    }
    const pkg: PackageJson = await file.json();
    if (pkg.name && pkg.version) {
      map.set(pkg.name, pkg.version);
    }
  }

  return map;
}

/**
 * Replace any "workspace:*" (or "workspace:^", "workspace:~") entry with the
 * real semver range "^<version>" resolved from the version map.
 *
 * Returns the patched copy; the original object is not mutated.
 */
function resolveWorkspaceDeps(
  deps: Record<string, string> | undefined,
  versionMap: Map<string, string>,
  section: string,
  pkgName: string,
): Record<string, string> | undefined {
  if (!deps) return undefined;

  const result: Record<string, string> = {};

  for (const [name, range] of Object.entries(deps)) {
    if (range.startsWith('workspace:')) {
      const resolved = versionMap.get(name);
      if (!resolved) {
        throw new Error(
          `Cannot resolve workspace dependency "${name}" in ${pkgName} (${section}). ` +
            'Add it to PUBLISH_ORDER so its version is available.',
        );
      }
      result[name] = `^${resolved}`;
    } else {
      result[name] = range;
    }
  }

  return result;
}

function applyPublishManifestOverrides(pkg: PackageJson, patched: PackageJson): void {
  const publishConfig = pkg.publishConfig;
  if (!publishConfig || typeof publishConfig !== 'object') {
    return;
  }

  for (const key of PUBLISH_OVERRIDE_KEYS) {
    if (!(key in publishConfig)) {
      continue;
    }

    const value = publishConfig[key];
    if (value === undefined) {
      continue;
    }

    if (key === 'main' || key === 'types') {
      if (typeof value !== 'string') {
        continue;
      }
      patched[key] = value;
      continue;
    }

    patched.exports = value;
  }
}

/**
 * Patch workspace:* → real semver in all dependency sections of the package.json.
 * Returns the original raw content so it can be restored afterward.
 */
async function patchPackageJson(workspace: string, versionMap: Map<string, string>): Promise<string> {
  const pkgPath = join(workspace, 'package.json');
  const original = await Bun.file(pkgPath).text();
  const pkg: PackageJson = JSON.parse(original);
  const name = pkg.name ?? workspace;

  const patched: PackageJson = {
    ...pkg,
    dependencies: resolveWorkspaceDeps(pkg.dependencies, versionMap, 'dependencies', name),
    peerDependencies: resolveWorkspaceDeps(pkg.peerDependencies, versionMap, 'peerDependencies', name),
    devDependencies: resolveWorkspaceDeps(pkg.devDependencies, versionMap, 'devDependencies', name),
    optionalDependencies: resolveWorkspaceDeps(pkg.optionalDependencies, versionMap, 'optionalDependencies', name),
  };

  // Ensure published package entries point to built dist output.
  applyPublishManifestOverrides(pkg, patched);

  // Drop undefined sections so the output stays clean
  for (const key of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'] as const) {
    if (patched[key] === undefined) {
      delete patched[key];
    }
  }

  await Bun.write(pkgPath, JSON.stringify(patched, null, 2) + '\n');

  // Show what was replaced
  const replacements: string[] = [];
  for (const section of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'] as const) {
    const orig = pkg[section];
    const next = patched[section];
    if (!orig || !next) continue;
    for (const [dep, range] of Object.entries(orig)) {
      if (range.startsWith('workspace:')) {
        replacements.push(`    ${section}.${dep}: ${range} → ${next[dep]}`);
      }
    }
  }

  if (replacements.length > 0) {
    console.log(`  Patched workspace:* → semver in ${name}:\n${replacements.join('\n')}`);
  }

  const publishConfig = pkg.publishConfig;
  if (publishConfig && typeof publishConfig === 'object') {
    const overridden = PUBLISH_OVERRIDE_KEYS.filter((key) => key in publishConfig);
    if (overridden.length > 0) {
      console.log(`  Applied publishConfig overrides in ${name}: ${overridden.join(', ')}`);
    }
  }

  return original;
}

/** Restore the original package.json content. */
async function restorePackageJson(workspace: string, original: string): Promise<void> {
  await Bun.write(join(workspace, 'package.json'), original);
}

/** Returns true if the given package@version is already published on npm. */
async function isAlreadyPublished(pkgName: string, pkgVersion: string): Promise<boolean> {
  const child = Bun.spawn(['npm', 'view', `${pkgName}@${pkgVersion}`, 'version'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  return exitCode === 0 && stdout.trim() === pkgVersion;
}

function bumpVersion(version: string, type: BumpType): string {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Cannot bump non-semver version: ${version}`);
  }
  const [major, minor, patch] = parts;
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

async function bumpAllVersions(targets: PackageTarget[], type: BumpType): Promise<void> {
  for (const target of targets) {
    const pkgPath = join(target.workspace, 'package.json');
    const pkg: PackageJson = await Bun.file(pkgPath).json();
    if (!pkg.version) throw new Error(`No version field in ${pkgPath}`);
    const next = bumpVersion(pkg.version, type);
    pkg.version = next;
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  Bumped ${target.name} → ${next}`);
  }
}

// -----------------------------------------------------------------
// Main
// -----------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const startIndex = resolveStartIndex(options.from, PUBLISH_ORDER);
  const targets = PUBLISH_ORDER.slice(startIndex);

  if (!targets.length) {
    console.log('No packages to publish.');
    return;
  }

  if (!options.skipWhoami) {
    await runCommand(['npm', 'whoami'], 'Checking npm authentication');
  }

  // Bump versions for all packages in the full order (so sibling refs resolve correctly).
  if (options.bump) {
    console.log(`\nBumping ${options.bump} version for all packages:`);
    await bumpAllVersions(PUBLISH_ORDER, options.bump);
  }

  // Build the version map once upfront so every package knows every sibling's version.
  const versionMap = await buildVersionMap();

  console.log('\nPublish order:');
  for (const target of targets) {
    console.log(`  - ${target.name}@${versionMap.get(target.name) ?? '?'}`);
  }

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const version = versionMap.get(target.name) ?? '?';

    if (!options.dryRun && await isAlreadyPublished(target.name, version)) {
      console.log(`\n[${index + 1}/${targets.length}] Skipping ${target.name}@${version} (already published)`);
      continue;
    }

    const args = ['publish', '--workspace', target.workspace];

    if (options.dryRun) {
      args.push('--dry-run');
    }

    if (options.tag) {
      args.push('--tag', options.tag);
    }

    if (options.access) {
      args.push('--access', options.access);
    }

    if (options.otp) {
      args.push('--otp', options.otp);
    }

    // Patch workspace:* → real semver before publishing, always restore after.
    const original = await patchPackageJson(target.workspace, versionMap);
    try {
      const label = `[${index + 1}/${targets.length}] Publishing ${target.name}`;
      console.log(`\n${label}`);
      const child = Bun.spawn(['npm', ...args], { stdin: 'inherit', stdout: 'inherit', stderr: 'pipe' });
      const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
      if (exitCode !== 0) {
        const isVersionConflict =
          stderr.includes('Cannot publish over previously published version') ||
          stderr.includes('cannot be republished until 24 hours have passed');
        if (isVersionConflict) {
          process.stderr.write(stderr);
          console.log(`  Skipped ${target.name}@${version} (version already exists on registry)`);
        } else {
          process.stderr.write(stderr);
          throw new Error(`${label} failed with exit code ${exitCode}`);
        }
      }
    } finally {
      await restorePackageJson(target.workspace, original);
    }
  }

  console.log('\nAll selected packages were published successfully.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nPublish aborted: ${message}`);
  process.exitCode = 1;
});
