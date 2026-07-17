import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const snapshotPath = path.join(root, 'docs', 'api', 'public-api.snapshot.json');
const writeMode = process.argv.includes('--write');

const snapshot = {
  generatedFrom: 'packages/*/src/index.ts',
  packages: {},
};

const packageDirs = await readdir(path.join(root, 'packages'), { withFileTypes: true });

for (const dirent of packageDirs) {
  if (!dirent.isDirectory()) continue;

  const packageDir = path.join(root, 'packages', dirent.name);
  const packageJsonPath = path.join(packageDir, 'package.json');
  const indexPath = path.join(packageDir, 'src', 'index.ts');

  let packageJson;
  let source;

  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    source = await readFile(indexPath, 'utf8');
  } catch {
    continue;
  }

  if (packageJson.private) continue;

  snapshot.packages[packageJson.name] = collectExportStatements(source);
}

const expected = JSON.stringify(snapshot, null, 2) + '\n';

if (writeMode) {
  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, expected);
  console.log(`Wrote ${path.relative(root, snapshotPath)}`);
  process.exit(0);
}

let actual;
try {
  actual = await readFile(snapshotPath, 'utf8');
} catch {
  console.error(`Missing ${path.relative(root, snapshotPath)}. Run "bun run api:snapshot".`);
  process.exit(1);
}

if (normalizeNewlines(actual) !== normalizeNewlines(expected)) {
  console.error('Public API snapshot is out of date. Run "bun run api:snapshot" and review the diff.');
  process.exit(1);
}

console.log('Public API snapshot is current.');

function collectExportStatements(source) {
  const statements = [];
  let current = '';

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    if (!current && line.startsWith('export ')) {
      current = line;
    } else if (current) {
      current += ` ${line}`;
    }

    if (current && current.endsWith(';')) {
      statements.push(normalizeStatement(current));
      current = '';
    }
  }

  if (current) {
    statements.push(normalizeStatement(current));
  }

  return statements;
}

function normalizeStatement(statement) {
  return statement
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;])/g, '$1')
    .replace(/\{\s+/g, '{ ')
    .replace(/\s+\}/g, ' }')
    .trim();
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n');
}
