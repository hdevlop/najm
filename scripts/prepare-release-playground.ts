import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PACKAGE_TARGETS } from './workspaces';

// Copy committed app files into a private consumer with no framework source tree.
// Every run gets its own database and loopback services; delivery secrets are excluded.
const root = resolve(import.meta.dir, '..');
const registry = process.argv.includes('--registry');
const consumer = mkdtempSync(join(tmpdir(), 'najm-release-'));
const files = execFileSync('git', ['ls-files', '--', 'apps/playground'], {cwd: root, encoding: 'utf8'}).trim().split(/\r?\n/);
for (const file of files) {
  if (file.includes('/.env') || /\.(db|sqlite)(?:-|$)/.test(file)) continue;
  const target = join(consumer, file);
  mkdirSync(dirname(target), {recursive: true});
  copyFileSync(join(root, file), target);
}
const versions = Object.fromEntries(PACKAGE_TARGETS.map(({name, workspace}) =>
  [name, JSON.parse(readFileSync(join(root, workspace, 'package.json'), 'utf8')).version]));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
manifest.name = 'najm-playground-release-acceptance';
manifest.private = true;
manifest.workspaces = ['apps/playground'];
manifest.scripts = {};
manifest.overrides ??= {};
Object.assign(manifest.overrides, versions);
if (!registry) {
  const candidate = JSON.parse(readFileSync(join(root, 'dist-publish/production-2026-10-04/artifacts.json'), 'utf8'));
  assert.equal(candidate.commit, execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim());
  mkdirSync(join(consumer, '.release-artifacts'));
  for (const pkg of candidate.packages) {
    const target = join(consumer, '.release-artifacts', `${pkg.name}-${pkg.version}.tgz`);
    copyFileSync(pkg.tarball, target);
    manifest.overrides[pkg.name] = `file:${target.replaceAll('\\', '/')}`;
  }
}
mkdirSync(join(consumer, 'patches'));
copyFileSync(join(root, 'patches/braces@3.0.3.patch'), join(consumer, 'patches/braces@3.0.3.patch'));
writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
const appManifestPath = join(consumer, 'apps/playground/package.json');
const appManifest = JSON.parse(readFileSync(appManifestPath, 'utf8'));
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const name of Object.keys(appManifest[section] ?? {})) {
    if (versions[name]) appManifest[section][name] = versions[name];
  }
}
appManifest.dependencies['najm-email'] = versions['najm-email'];
writeFileSync(appManifestPath, JSON.stringify(appManifest, null, 2) + '\n');
const configPath = join(consumer, 'apps/playground/tsconfig.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.compilerOptions.paths = Object.fromEntries(Object.entries(config.compilerOptions.paths).filter(([name]) => !name.startsWith('najm-')));
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
const acceptance = join(consumer, 'apps/playground/src/release-acceptance');
mkdirSync(acceptance, {recursive: true});
writeFileSync(join(acceptance, 'smtp.test.ts'), "import 'reflect-metadata';\n" + readFileSync(join(root, 'packages/najm-email/test/smtp-provider.test.ts'), 'utf8').replace("'../src/providers/SmtpProvider'", "'najm-email'"));
writeFileSync(join(acceptance, 'query-rewrites.test.ts'), readFileSync(join(root, 'packages/najm-rag/test/query-rewrites.test.ts'), 'utf8').replace("'../src/queryRewrites'", "'najm-rag/query-rewrites'"));
console.log(`Consumer: ${consumer}`);
const installed = Bun.spawn([process.execPath, 'install', '--linker', 'hoisted'], {cwd: consumer, stdout: 'inherit', stderr: 'inherit'});
assert.equal(await installed.exited, 0, 'Consumer installation failed');
console.log(`Run: bun scripts/check-release-playground.ts --consumer "${consumer}"${registry ? ' --registry' : ''}`);
