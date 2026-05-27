import { Controller, Get, Path } from 'najm-core';
import { existsSync, readFileSync } from 'fs';
import { join, extname, resolve, sep, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function resolveDistRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const req = createRequire(import.meta.url);
    const pkgJsonPath = req.resolve('najm-rag-studio/package.json');
    return join(dirname(pkgJsonPath), 'dist');
  } catch {
    return join(here, '..', '..', '..', 'najm-rag-studio', 'dist');
  }
}

const DIST_ROOT = resolveDistRoot();

@Controller('/rag-studio')
export class RagStudioStaticController {
  @Get('/*')
  async serve(@Path() path: string) {
    const safePath = path.replace(/^(\.\.(\/|\$))+/g, '');
    const filePath = safePath ? join(DIST_ROOT, safePath) : join(DIST_ROOT, 'index.html');
    const resolvedPath = resolve(filePath);

    if (!resolvedPath.startsWith(resolve(DIST_ROOT) + sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    let target = resolvedPath;
    if (!existsSync(target) || !safePath) {
      target = join(DIST_ROOT, 'index.html');
    }

    if (!existsSync(target)) {
      return new Response('Studio UI not built. Run `bun run build` in najm-rag-studio.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const ext = extname(target);
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';
    const content = readFileSync(target);

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-store, must-revalidate' : 'public, max-age=86400',
      },
    });
  }
}
