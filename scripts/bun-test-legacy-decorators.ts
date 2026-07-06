import ts from 'typescript';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRuntimePattern =
  /[\\/]packages[\\/](?:najm-storage[\\/]src[\\/](?!studio[\\/])|(?!(?:najm-storage)[\\/])[^\\/]+[\\/]src[\\/]|(?:najm-chatbot|najm-whatsapp)[\\/]test[\\/]).*\.(ts|tsx)$/;
const workspacePackagePattern = /^najm-[^/]+(?:\/.+)?$/;
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveWorkspacePackage(specifier: string): string | null {
  const [packageName, ...subpathParts] = specifier.split('/');
  const packageRoot = resolve(repoRoot, 'packages', packageName);

  if (!existsSync(packageRoot)) {
    return null;
  }

  if (!subpathParts.length) {
    return firstExisting([
      resolve(packageRoot, 'src', 'index.ts'),
      resolve(packageRoot, 'src', 'index.tsx'),
    ]);
  }

  const subpath = subpathParts.join('/');
  const candidates = [
    resolve(packageRoot, 'src', `${subpath}.ts`),
    resolve(packageRoot, 'src', `${subpath}.tsx`),
    resolve(packageRoot, 'src', subpath, 'index.ts'),
    resolve(packageRoot, 'src', subpath, 'index.tsx'),
  ];

  if (subpathParts.length === 1) {
    candidates.push(
      resolve(packageRoot, 'src', 'schema', `${subpath}.ts`),
      resolve(packageRoot, 'src', 'schema', `${subpath}.tsx`),
    );
  }

  return firstExisting(candidates);
}

function transpilePackageSource(source: string, path: string): string {
  const result = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  });

  return rewriteWorkspaceImports(result.outputText);
}

function rewriteWorkspaceImports(output: string): string {
  return output
    .replace(
      /(from\s*["'])(najm-[^"']+)(["'])/g,
      (match, prefix: string, specifier: string, suffix: string) => {
        const sourcePath = resolveWorkspacePackage(specifier);
        return sourcePath ? `${prefix}${pathToFileURL(sourcePath).href}${suffix}` : match;
      },
    )
    .replace(
      /(import\s*\(\s*["'])(najm-[^"']+)(["']\s*\))/g,
      (match, prefix: string, specifier: string, suffix: string) => {
        const sourcePath = resolveWorkspacePackage(specifier);
        return sourcePath ? `${prefix}${pathToFileURL(sourcePath).href}${suffix}` : match;
      },
    );
}

Bun.plugin({
  name: 'najm-test-legacy-decorators',
  setup(build) {
    build.onResolve({ filter: workspacePackagePattern }, (args) => {
      const path = resolveWorkspacePackage(args.path);
      if (process.env.NAJM_DEBUG_TEST_RESOLVE === '1') {
        console.log(`[najm-test-resolve] ${args.path} -> ${path ?? '<default>'}`);
      }
      return path ? { path } : undefined;
    });

    build.onLoad({ filter: packageRuntimePattern }, async (args) => {
      const source = await Bun.file(args.path).text();

      return {
        contents: transpilePackageSource(source, args.path),
        loader: 'js',
      };
    });
  },
});
