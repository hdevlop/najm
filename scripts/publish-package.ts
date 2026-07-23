#!/usr/bin/env bun

import { join } from 'node:path';
import { PACKAGE_TARGETS, type PackageTarget } from './workspaces.ts';

type BumpType = 'patch' | 'minor' | 'major';

type CliOptions = {
  packageRef?: string;
  dryRun: boolean;
  tag?: string;
  otp?: string;
  access?: 'public' | 'restricted';
  skipWhoami: boolean;
  noBuild: boolean;
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
  console.log('Usage: bun scripts/publish-package.ts <name|workspace> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run         Run npm publish in dry-run mode');
  console.log('  --tag <tag>       Publish with npm dist-tag');
  console.log('  --otp <code>      Provide npm 2FA one-time password');
  console.log('  --access <mode>   Access level: public or restricted');
  console.log('  --skip-whoami     Skip npm whoami precheck');
  console.log('  --no-build        Skip package build before publish');
  console.log('  --patch           Bump patch version before publishing');
  console.log('  --minor           Bump minor version before publishing');
  console.log('  --major           Bump major version before publishing');
  console.log('  --help            Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  bun scripts/publish-package.ts najm-core');
  console.log('  bun scripts/publish-package.ts packages/najm-api --dry-run');
  console.log('  bun scripts/publish-package.ts najm-core --patch');
  console.log('  bun scripts/publish-package.ts najm-core --patch --otp 123456');
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    skipWhoami: false,
    noBuild: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (!arg.startsWith('-') && !options.packageRef) {
      options.packageRef = arg;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--skip-whoami') {
      options.skipWhoami = true;
      continue;
    }

    if (arg === '--no-build') {
      options.noBuild = true;
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

    if (arg === '--tag') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --tag');
      options.tag = value;
      index += 1;
      continue;
    }

    if (arg === '--otp') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --otp');
      options.otp = value;
      index += 1;
      continue;
    }

    if (arg === '--access') {
      const access = argv[index + 1];
      if (!access) throw new Error('Missing value for --access');
      if (access !== 'public' && access !== 'restricted') {
        throw new Error(`Invalid --access value: ${access}`);
      }
      options.access = access;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.packageRef) throw new Error('Missing package name/workspace.');

  return options;
}

function resolveTarget(packageRef: string): PackageTarget {
  const normalized = packageRef.trim();
  const target = PUBLISH_ORDER.find(
    (entry) => entry.name === normalized || entry.workspace === normalized,
  );

  if (!target) {
    throw new Error(`Unknown package: ${packageRef}`);
  }

  return target;
}

async function runCommand(command: string[], label: string): Promise<void> {
  console.log(`\n${label}`);
  const child = Bun.spawn(command, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
}

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

function resolveWorkspaceDeps(
  deps: Record<string, string> | undefined,
  versionMap: Map<string, string>,
  section: string,
  pkgName: string,
): Record<string, string> | undefined {
  if (!deps) return undefined;

  const result: Record<string, string> = {};
  for (const [name, range] of Object.entries(deps)) {
    if (range.startsWith("workspace:")) {
      const resolved = versionMap.get(name);
      if (!resolved) {
        throw new Error(
          `Cannot resolve workspace dependency "${name}" in ${pkgName} (${section}).`,
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
  if (!publishConfig || typeof publishConfig !== "object") return;

  for (const key of PUBLISH_OVERRIDE_KEYS) {
    if (!(key in publishConfig)) continue;
    const value = publishConfig[key];
    if (value === undefined) continue;

    if (key === "main" || key === "types") {
      if (typeof value === "string") patched[key] = value;
      continue;
    }

    patched.exports = value;
  }
}

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

  applyPublishManifestOverrides(pkg, patched);

  for (const key of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'] as const) {
    if (patched[key] === undefined) delete patched[key];
  }

  await Bun.write(pkgPath, JSON.stringify(patched, null, 2) + '\n');
  return original;
}

async function restorePackageJson(workspace: string, original: string): Promise<void> {
  await Bun.write(join(workspace, 'package.json'), original);
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

async function bumpPackageVersion(workspace: string, type: BumpType): Promise<string> {
  const pkgPath = join(workspace, 'package.json');
  const pkg: PackageJson = await Bun.file(pkgPath).json();

  if (!pkg.version) throw new Error(`No version field in ${pkgPath}`);

  const next = bumpVersion(pkg.version, type);
  pkg.version = next;
  await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  console.log(`\nBumped ${pkg.name} version → ${next}`);
  return next;
}

async function assertVersionNotPublished(pkgName: string, pkgVersion: string): Promise<void> {
  const child = Bun.spawn(['npm', 'view', pkgName, 'version'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  if (exitCode !== 0) {
    return;
  }

  const latest = stdout.trim();
  if (latest === pkgVersion) {
    throw new Error(`${pkgName}@${pkgVersion} is already published. Bump the version first.`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const target = resolveTarget(options.packageRef!);

  if (!options.skipWhoami) {
    await runCommand(['npm', 'whoami'], 'Checking npm authentication');
  }

  if (options.bump) {
    await bumpPackageVersion(target.workspace, options.bump);
  }

  // Rebuild version map after optional bump so it reflects the new version.
  const versionMap = await buildVersionMap();
  const version = versionMap.get(target.name);

  if (!version) {
    throw new Error(`Could not determine version for ${target.name}`);
  }

  if (!options.noBuild) {
    await runCommand(['bunx', 'turbo', 'run', 'build', '--filter', target.name], `Building ${target.name}`);
  }

  if (!options.dryRun) {
    await assertVersionNotPublished(target.name, version);
  }

  const args = ['publish', '--workspace', target.workspace];
  if (options.dryRun) args.push('--dry-run');
  if (options.tag) args.push('--tag', options.tag);
  if (options.access) args.push('--access', options.access);
  if (options.otp) args.push('--otp', options.otp);

  const original = await patchPackageJson(target.workspace, versionMap);
  try {
    await runCommand(['npm', ...args], `Publishing ${target.name}@${version}`);
  } finally {
    await restorePackageJson(target.workspace, original);
  }

  console.log(`\nDone. Published ${target.name}@${version}${options.dryRun ? " (dry-run)" : ""}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nPublish aborted: ${message}`);
  process.exitCode = 1;
});
