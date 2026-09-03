#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PACKAGE_TARGETS, type PackageTarget } from './workspaces.ts';

type BumpType = 'patch' | 'minor' | 'major';

type CliOptions = {
  packageRef?: string;
  dryRun: boolean;
  tag?: string;
  otp?: string;
  access?: 'public' | 'restricted';
  skipWhoami: boolean;
  bump?: BumpType;
  packOnly: boolean;
  publishTarball?: string;
  tarballDir: string;
  verifyPublished?: string;
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

export const PUBLISH_OVERRIDE_KEYS = ['main', 'types', 'exports'] as const;
export const PUBLISH_ORDER: PackageTarget[] = PACKAGE_TARGETS;
export const DEFAULT_TARBALL_DIR = 'dist-publish';
export const COMMIT_SIDECAR_SUFFIX = '.commit';

export function sidecarPath(tarballPath: string): string {
  return `${tarballPath}${COMMIT_SIDECAR_SUFFIX}`;
}

function printUsage(): void {
  console.log('Usage: bun scripts/publish-package.ts <name|workspace> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run              Run npm publish in dry-run mode');
  console.log('  --tag <tag>            Publish with npm dist-tag');
  console.log('  --otp <code>           Provide npm 2FA one-time password');
  console.log('  --access <mode>        Access level: public or restricted');
  console.log('  --skip-whoami          Skip npm whoami precheck');
  console.log('  --patch                Prepare a patch version, then exit for review/commit');
  console.log('  --minor                Prepare a minor version, then exit for review/commit');
  console.log('  --major                Prepare a major version, then exit for review/commit');
  console.log('  --pack-only            Pack the tarball, print its path and SHA-256, then exit');
  console.log('  --publish-tarball <p>  Publish the exact tarball at <p> instead of --workspace');
  console.log('  --tarball-dir <dir>    Directory for produced tarballs (default: dist-publish)');
  console.log('  --verify-published <v> Fetch the registry integrity hash for <v> and print it');
  console.log('  --help                 Show this help message');
  console.log('');
  console.log('Pack-then-publish flow (source-commit attributable gate):');
  console.log('  bun scripts/publish-package.ts najm-kit --pack-only');
  console.log('  bun scripts/publish-package.ts najm-kit --publish-tarball dist-publish/najm-kit-2.1.49.tgz');
  console.log('  bun scripts/publish-package.ts najm-kit --verify-published 2.1.49');
  console.log('');
  console.log('Examples:');
  console.log('  bun scripts/publish-package.ts najm-core');
  console.log('  bun scripts/publish-package.ts packages/najm-api --dry-run');
  console.log('  bun scripts/publish-package.ts najm-core --patch');
  console.log('  bun scripts/publish-package.ts najm-core --patch');
  console.log('  git add packages/najm-core/package.json && git commit');
  console.log('  bun scripts/publish-package.ts najm-core --pack-only');
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    skipWhoami: false,
    packOnly: false,
    tarballDir: DEFAULT_TARBALL_DIR,
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

    if (arg === '--pack-only') {
      options.packOnly = true;
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

    if (arg === '--publish-tarball') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --publish-tarball');
      options.publishTarball = value;
      index += 1;
      continue;
    }

    if (arg === '--tarball-dir') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --tarball-dir');
      options.tarballDir = value;
      index += 1;
      continue;
    }

    if (arg === '--verify-published') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --verify-published');
      options.verifyPublished = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.verifyPublished && !options.packageRef) {
    throw new Error('Missing package name/workspace.');
  }

  if (options.bump && (
    options.dryRun
    || options.packOnly
    || options.publishTarball
    || options.verifyPublished
    || options.tag
    || options.otp
    || options.access
    || options.skipWhoami
  )) {
    throw new Error('Version preparation flags cannot be combined with pack, publish, verify, or skip flags.');
  }

  return options;
}

export function resolveTarget(packageRef: string): PackageTarget {
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

async function runCommandCapture(command: string[], label: string): Promise<string> {
  console.log(`\n${label}`);
  const child = Bun.spawn(command, {
    stdin: "inherit",
    stdout: "pipe",
    stderr: "inherit",
  });
  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
  return stdout;
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

export function bumpVersion(version: string, type: BumpType): string {
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

export function sha256OfFile(path: string): string {
  const buffer = readFileSync(path);
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

export function parseNpmPackFilename(stdout: string): string {
  const trimmed = stdout.trim();
  let searchFrom = trimmed.length;

  while (searchFrom > 0) {
    const start = trimmed.lastIndexOf('[', searchFrom - 1);
    if (start === -1) break;

    try {
      const parsed = JSON.parse(trimmed.slice(start)) as Array<{ filename?: unknown }>;
      const filename = parsed[0]?.filename;
      if (typeof filename === 'string' && filename.length > 0) return filename;
    } catch {
      // Lifecycle scripts may write arbitrary stdout before npm's final JSON payload.
    }

    searchFrom = start;
  }

  throw new Error('npm pack --json did not return a tarball name');
}

export function currentCommitSha(): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function assertCleanStatus(status: string): void {
  const entries = status.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  if (entries.length === 0) return;

  const preview = entries.slice(0, 12).join('\n  ');
  const remainder = entries.length > 12 ? `\n  ...and ${entries.length - 12} more` : '';
  throw new Error(
    `Release requires a clean worktree. Commit or remove every tracked and untracked change first:\n  ${preview}${remainder}`,
  );
}

export function assertCleanWorktree(): void {
  let status: string;
  try {
    status = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    ).toString();
  } catch {
    throw new Error('Release requires a readable Git worktree. `git status` failed.');
  }
  assertCleanStatus(status);
}

async function runReleaseChecks(target: PackageTarget): Promise<void> {
  assertCleanWorktree();
  await runCommand(
    ['bunx', 'turbo', 'run', 'build', '--filter', target.name],
    `Building ${target.name}`,
  );
  await runCommand(
    ['bunx', 'turbo', 'run', 'test', '--filter', target.name],
    `Testing ${target.name}`,
  );
  await runCommand(['bun', 'run', 'api:check'], 'Checking public API snapshots');
  assertCleanWorktree();
}

async function packTarball(
  workspace: string,
  tarballDir: string,
  versionMap: Map<string, string>,
): Promise<{ path: string; sha256: string; name: string; commit: string | null }> {
  const absoluteDir = resolve(process.cwd(), tarballDir);
  if (!existsSync(absoluteDir)) mkdirSync(absoluteDir, { recursive: true });

  const original = await patchPackageJson(workspace, versionMap);
  try {
    const stdout = await runCommandCapture(
      ['npm', 'pack', '--json', '--pack-destination', absoluteDir, '--workspace', workspace],
      `Packing ${workspace}`,
    );
    let tarballName: string;
    try {
      tarballName = parseNpmPackFilename(stdout);
    } catch {
      throw new Error(`npm pack --json did not return a tarball name for ${workspace}`);
    }
    const finalPath = resolve(absoluteDir, tarballName);
    if (!existsSync(finalPath)) {
      throw new Error(`npm pack did not produce ${finalPath}`);
    }

    const sha256 = sha256OfFile(finalPath);
    const commit = currentCommitSha();
    if (commit) {
      writeFileSync(sidecarPath(finalPath), `${commit}\n`, 'utf8');
    }
    return { path: finalPath, sha256, name: tarballName, commit };
  } finally {
    await restorePackageJson(workspace, original);
  }
}

export function readPackingCommit(tarballPath: string): string | null {
  const sidecar = sidecarPath(tarballPath);
  if (!existsSync(sidecar)) return null;
  const value = readFileSync(sidecar, 'utf8').trim();
  return value || null;
}

async function publishTarball(
  tarballPath: string,
  options: { tag?: string; access?: 'public' | 'restricted'; otp?: string; dryRun: boolean },
): Promise<void> {
  const packingCommit = readPackingCommit(tarballPath);
  const currentCommit = currentCommitSha();
  if (packingCommit && currentCommit && packingCommit !== currentCommit) {
    throw new Error(
      `Tarball was packed at commit ${packingCommit} but the current commit is ${currentCommit}. ` +
        `Either checkout the packing commit or repack the tarball.`,
    );
  }

  const args = ['publish', tarballPath];
  if (options.dryRun) args.push('--dry-run');
  if (options.tag) args.push('--tag', options.tag);
  if (options.access) args.push('--access', options.access);
  if (options.otp) args.push('--otp', options.otp);

  await runCommand(['npm', ...args], `Publishing ${tarballPath}`);
}

async function verifyPublished(pkgName: string, version: string): Promise<void> {
  const integrity = await runCommandCapture(
    ['npm', 'view', `${pkgName}@${version}`, 'dist.integrity'],
    `Fetching registry integrity for ${pkgName}@${version}`,
  );
  const shasum = await runCommandCapture(
    ['npm', 'view', `${pkgName}@${version}`, 'dist.shasum'],
    `Fetching registry shasum for ${pkgName}@${version}`,
  );
  const tarballUrl = await runCommandCapture(
    ['npm', 'view', `${pkgName}@${version}`, 'dist.tarball'],
    `Fetching registry tarball URL for ${pkgName}@${version}`,
  );

  console.log(`\nRegistry evidence for ${pkgName}@${version}:`);
  console.log(`  integrity: ${integrity.trim()}`);
  console.log(`  shasum:   ${shasum.trim()}`);
  console.log(`  tarball:  ${tarballUrl.trim()}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.verifyPublished) {
    const target = resolveTarget(options.packageRef ?? options.verifyPublished.split('@')[0]);
    await verifyPublished(target.name, options.verifyPublished);
    return;
  }

  const target = resolveTarget(options.packageRef!);

  if (options.bump) {
    assertCleanWorktree();
    const version = await bumpPackageVersion(target.workspace, options.bump);
    console.log(`\nVersion prepared: ${target.name}@${version}`);
    console.log('Review and commit the version/changelog, then rerun without a bump flag.');
    return;
  }

  await runReleaseChecks(target);

  if (options.packOnly) {
    if (!options.skipWhoami) {
      try {
        await runCommand(['npm', 'whoami'], 'Checking npm authentication');
      } catch {
        console.log('Skipping npm whoami (npm pack does not require auth).');
      }
    }

    assertCleanWorktree();

    const versionMap = await buildVersionMap();
    const version = versionMap.get(target.name);
    if (!version) {
      throw new Error(`Could not determine version for ${target.name}`);
    }

    const tarball = await packTarball(target.workspace, options.tarballDir, versionMap);

    console.log(`\nPack complete:`);
    console.log(`  package:   ${target.name}@${version}`);
    console.log(`  path:      ${tarball.path}`);
    console.log(`  filename:  ${tarball.name}`);
    console.log(`  sha256:    ${tarball.sha256}`);
    console.log(`  packing-commit: ${tarball.commit ?? "(none)"}`);
    if (tarball.commit) {
      console.log(`  sidecar:   ${sidecarPath(tarball.path)}`);
    }
    console.log(`\nTo publish this exact tarball:`);
    console.log(`  bun scripts/publish-package.ts ${target.name} --publish-tarball ${tarball.path}`);
    return;
  }

  if (!options.skipWhoami) {
    await runCommand(['npm', 'whoami'], 'Checking npm authentication');
  }

  // The committed package version is the release version.
  const versionMap = await buildVersionMap();
  const version = versionMap.get(target.name);

  if (!version) {
    throw new Error(`Could not determine version for ${target.name}`);
  }

  assertCleanWorktree();

  if (!options.dryRun && !options.publishTarball) {
    await assertVersionNotPublished(target.name, version);
  }

  if (options.publishTarball) {
    const tarballPath = resolve(process.cwd(), options.publishTarball);
    if (!existsSync(tarballPath)) {
      throw new Error(`Tarball not found: ${tarballPath}`);
    }
    const sha256 = sha256OfFile(tarballPath);
    const packingCommit = readPackingCommit(tarballPath);
    const currentCommit = currentCommitSha();
    console.log(`\nPublishing tarball (source-commit attributable):`);
    console.log(`  path:           ${tarballPath}`);
    console.log(`  sha256:         ${sha256}`);
    if (packingCommit) console.log(`  packing-commit: ${packingCommit}`);
    if (currentCommit) console.log(`  current-commit: ${currentCommit}`);
    await publishTarball(tarballPath, options);
    console.log(`\nDone. Published ${target.name}@${version} from ${tarballPath}${options.dryRun ? " (dry-run)" : ""}.`);
    console.log(`Verify the registry integrity with:`);
    console.log(`  bun scripts/publish-package.ts ${target.name} --verify-published ${version}`);
    return;
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

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nPublish aborted: ${message}`);
    process.exitCode = 1;
  });
}
