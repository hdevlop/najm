import assert from 'node:assert/strict';
import { openSync, closeSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const argument = process.argv.indexOf('--consumer');
assert(argument !== -1 && process.argv[argument + 1], 'Usage: bun scripts/check-release-playground.ts --consumer <isolated-directory> [--registry]');
const consumer = resolve(process.argv[argument + 1]);
const manifest = JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8'));
assert.equal(manifest.name, 'najm-playground-release-acceptance', 'Only an isolated release fixture may be tested');
const config = JSON.parse(readFileSync(join(consumer, 'apps/playground/tsconfig.json'), 'utf8'));
assert(!Object.keys(config.compilerOptions.paths ?? {}).some((name) => name.startsWith('najm-')), 'Source aliases would invalidate package acceptance');
const app = join(consumer, 'apps/playground');
const runtime = join(consumer, '.runtime'); mkdirSync(runtime, {recursive: true});
const port = 34500 + Math.floor(Math.random() * 500);
const origin = `http://127.0.0.1:${port}`;
const embeddingStub = Bun.serve({hostname: '127.0.0.1', port: 0, fetch: async (request) => {
 const input = await request.json(); const texts = Array.isArray(input.input) ? input.input : [input.input];
 return Response.json({embeddings: texts.map(() => Array(768).fill(0.01))});
}});
const env = {...process.env, NODE_ENV: 'production', DATABASE_URL: join(runtime, `playground-release-${Date.now()}.db`),
 JWT_ACCESS_SECRET: 'playground-release-test-access-secret-at-least-32-characters',
 JWT_REFRESH_SECRET: 'playground-release-test-refresh-secret-at-least-32-characters',
 COOKIE_SECURE: 'false', FRONTEND_URL: origin, PLAYGROUND_E2E_BASE_URL: origin,
 OLLAMA_BASE_URL: embeddingStub.url.origin, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
 NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true', NAJM_AUTH_LOGIN_RATE_LIMIT: '8', NAJM_AUTH_LOGIN_RATE_WINDOW: '10m',
};
let server: ReturnType<typeof Bun.spawn> | undefined;
const outcomes: Record<string, unknown> = {consumer, origin, mode: process.argv.includes('--registry') ? 'registry' : 'tarballs'};
async function run(command: string[], label: string, childEnv = env) {
 console.log(`Running ${label}`); const fd = openSync(join(runtime, `${label}.log`), 'w');
 const child = Bun.spawn(command, {cwd: app, env: childEnv, stdout: fd, stderr: fd});
 const code = await child.exited; closeSync(fd);
 if (code !== 0) { console.error(readFileSync(join(runtime, `${label}.log`), 'utf8').slice(-7000)); throw new Error(`${label} exited ${code}`); }
 outcomes[label] = 'PASS'; console.log(`${label}: PASS`);
}
const cookies = new Map<string, string>();
function absorb(response: Response) {
 for (const value of response.headers.getSetCookie()) {
  const pair = value.split(';')[0]; const split = pair.indexOf('='); const name = pair.slice(0, split);
  if (pair.slice(split + 1)) cookies.set(name, pair.slice(split + 1)); else cookies.delete(name);
 }
}
async function request(path: string, init: RequestInit = {}) {
 const headers = new Headers(init.headers); if (cookies.size) headers.set('Cookie', [...cookies].map(([name,value]) => `${name}=${value}`).join('; '));
 const response = await fetch(origin + path, {...init, headers, redirect: 'manual'}); absorb(response); return response;
}
async function jsonPost(path: string, body: unknown, extra: Record<string, string> = {}) {
 return request(path, {method: 'POST', headers: {'Content-Type': 'application/json', ...extra}, body: JSON.stringify(body)});
}
try {
 await run([process.execPath, 'run', 'db:migrate'], 'database-migrate');
 await run([process.execPath, 'run', 'db:seed'], 'database-seed');
 await run([process.execPath, 'run', 'test'], 'published-package-tests', {...env, NODE_ENV: 'test'});
 if (!process.argv.includes('--skip-build')) await run([process.execPath, 'run', 'build:next'], 'production-build');
 else outcomes['production-build'] = 'REUSED previously successful production artifact';
 const require = createRequire(join(app, 'package.json'));
 const next = join(dirname(require.resolve('next/package.json')), 'dist/bin/next');
 const log = openSync(join(runtime, 'production-server.log'), 'w');
 server = Bun.spawn([process.execPath, next, 'start', '-H', '127.0.0.1', '-p', String(port)], {cwd: app, env, stdout: log, stderr: log});
 closeSync(log);
 let ready = false;
 for (let attempt = 0; attempt < 100; attempt++) {
  try { const response = await fetch(origin + '/login'); if (response.ok) {ready = true; break;} } catch {}
  if (server.exitCode !== null) throw new Error('Next exited before becoming ready');
  await Bun.sleep(200);
 }
 assert(ready, 'Production Next did not become ready');
 const health = await request('/api/health');
 assert.equal(health.status, 200, 'Health API failed: ' + await health.clone().text());
 outcomes.health = 'PASS';
 const login = await jsonPost('/api/auth/login', {identifier: 'admin@admin.com', password: 'Admin123!', rememberMe: true});
 assert.equal(login.status, 200, 'Login failed: ' + await login.clone().text());
 const payload = await login.json(); const accessToken = payload.data?.accessToken ?? payload.accessToken;
 assert.equal(typeof accessToken, 'string', 'No access token returned');
 assert(cookies.has('refreshToken') && cookies.has('najm.session'), 'Login did not persist refresh and signed session cookies');
 outcomes.login = 'PASS';
 const appRequire = createRequire(join(app, 'package.json'));
 const { Client } = await import(pathToFileURL(appRequire.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
 const { StreamableHTTPClientTransport } = await import(pathToFileURL(appRequire.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')).href);
 const mcpClient = new Client({name: 'release-acceptance', version: '1.0.0'});
 try {
  await mcpClient.connect(new StreamableHTTPClientTransport(new URL(origin + '/api/mcp'), {requestInit: {headers: {Authorization: `Bearer ${accessToken}`}}}));
  const tools = await mcpClient.listTools();
  const healthTool = tools.tools.find((tool: any) => tool.description === 'Check playground API health');
  assert(healthTool, 'The health controller was not exposed to the MCP client');
  const result = await mcpClient.callTool({name: healthTool.name, arguments: {}});
  assert(!result.isError, 'MCP health invocation failed: ' + JSON.stringify(result));
  outcomes.mcpInitializeListInvoke = 'PASS';
 } finally {await mcpClient.close();}
 const protectedPage = await request('/dashboard'); assert.equal(protectedPage.status, 200, 'Protected navigation failed');
 const refresh = await jsonPost('/api/auth/refresh', {}); assert.equal(refresh.status, 200, 'Refresh failed: ' + await refresh.clone().text());
 cookies.delete('najm.session');
 const recover = await jsonPost('/api/auth/session/recover', {}, {'X-Najm-Session-Recovery': '1'}); assert.equal(recover.status, 200, 'Recovery failed: ' + await recover.clone().text());
 assert(cookies.has('najm.session'), 'Recovery did not restore the signed session cookie');
 outcomes.refreshAndRecovery = 'PASS';
 const authorization = {Authorization: `Bearer ${accessToken}`};
 const uploaded = await request('/api/release-acceptance/files/smoke.txt', {method: 'POST', headers: {...authorization, 'Content-Type': 'text/plain'}, body: 'published-release-upload'});
 assert.equal(uploaded.status, 200, 'Upload failed: ' + await uploaded.clone().text());
 const downloaded = await request('/api/release-acceptance/files/serve/smoke.txt', {headers: authorization});
 assert.equal(downloaded.status, 200); assert.equal(await downloaded.text(), 'published-release-upload');
 const removed = await request('/api/release-acceptance/files/smoke.txt', {method: 'DELETE', headers: authorization}); assert.equal(removed.status, 200);
 outcomes.uploadDownloadDelete = 'PASS';
 await run([process.execPath, 'x', 'playwright', 'test'], 'production-browser');
 let throttled = false;
 for (let attempt = 0; attempt < 10; attempt++) {
  const response = await jsonPost('/api/auth/login', {identifier: 'unknown-release@example.test', password: 'Incorrect123!'}, {'X-Forwarded-For': `203.0.113.${attempt + 1}`, 'X-Real-IP': `198.51.100.${attempt + 1}`});
  assert([401, 403, 429].includes(response.status), 'Unexpected rate probe status: ' + response.status + ' ' + await response.clone().text());
  if (response.status === 429) {throttled = true; break;}
 }
 assert(throttled, 'Rotating forwarded headers escaped the login allowance');
 const blocked = await jsonPost('/api/auth/login', {identifier: 'unknown-release@example.test', password: 'Incorrect123!'}, {'X-Forwarded-For': '203.0.113.250', 'X-Real-IP': '198.51.100.250'});
 assert.equal(blocked.status, 429, 'Another forged header escaped the exhausted bucket');
 outcomes.spoofedHeaderRateLimit = 'PASS';
 const logout = await jsonPost('/api/auth/logout', {}); assert.equal(logout.status, 200); outcomes.logout = 'PASS';
 console.log(JSON.stringify(outcomes, null, 2));
 writeFileSync(join(runtime, 'acceptance.json'), JSON.stringify(outcomes, null, 2) + '\n');
} finally {
 if (server) {server.kill(); await server.exited;} embeddingStub.stop(true);
}
