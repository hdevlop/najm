/**
 * RAG Studio Smoke Tests
 *
 * Phase 8 — Playground Integration
 *
 * Tests the Studio SPA, API endpoints, semantic editing,
 * knowledge search, and routing test cases against a real
 * Najm server with all plugins wired.
 *
 * Prerequisites:
 *   - bun install (workspace deps resolved)
 *   - najm-rag dist built (bun run build in packages/najm-rag)
 *   - studio SPA built (bun run build in packages/najm-rag/studio)
 *   - playground.db has RAG tables (bun scripts/add-rag-tables.ts)
 *
 * Run:  bun run test:studio
 */

import 'reflect-metadata';

import { Server } from 'najm-api';
import {
  databaseConfig,
  authConfig,
  corsConfig,
  i18nConfig,
  eventsConfig,
  mcpConfig,
  validationConfig,
  rateLimitConfig,
  storageConfig,
  ragConfig,
  chatbotConfig,
  whatsappConfig,
} from '../src/server/config/plugins';
import * as modulesModule from '../src/server/modules';
import * as listenersModule from '../src/server/listeners';

const TOKEN = process.env.RAG_STUDIO_TOKEN || 'rag-studio-dev-token-32chars-min-a1b2c3d4e5';
const STUDIO_API = '/api/rag-studio/api';

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, passed: true, detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.log(`  ❌ ${name} — ${detail}`);
}

function skip(name: string, detail: string) {
  results.push({ name, passed: true, detail: `SKIPPED: ${detail}` });
  console.log(`  ⏭️  ${name} — skipped: ${detail}`);
}

function authHeaders() {
  return { Authorization: `Bearer ${TOKEN}` };
}

async function main() {
  const server = new Server({ isolated: true })
    .use(corsConfig())
    .use(databaseConfig())
    .use(i18nConfig())
    .use(validationConfig())
    .use(eventsConfig())
    .use(rateLimitConfig())
    .use(mcpConfig())
    .use(authConfig())
    .use(storageConfig())
    .use(ragConfig())
    .use(chatbotConfig())
    .use(whatsappConfig())
    .base('/api')
    .load(modulesModule, listenersModule);

  let port: number;
  try {
    await server.listen(0);
    port = server.port!;
  } catch (err: any) {
    console.error('Failed to boot server:', err.message);
    process.exit(1);
  }

  const baseUrl = `http://localhost:${port}`;
  let semanticId: string | undefined;
  let embeddingsAvailable = false;

  try {
    console.log(`\n🔍 RAG Studio Smoke Tests (port ${port})\n`);

    // ========================================================
    // 1. Studio SPA + API status
    // ========================================================
    console.log('--- Studio SPA & API Status ---');

    let res = await fetch(`${baseUrl}/api/rag-studio`);
    if (res.status === 200) {
      const text = await res.text();
      if (text.includes('<html') || text.includes('<!DOCTYPE')) {
        pass('GET /api/rag-studio serves HTML SPA');
      } else {
        fail('GET /api/rag-studio', `got HTML but content doesn't look like SPA: ${text.substring(0, 80)}`);
      }
    } else if (res.status === 503) {
      skip('GET /api/rag-studio SPA', 'Studio not built (dist/studio missing)');
    } else {
      fail('GET /api/rag-studio', `expected 200 or 503, got ${res.status}`);
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/status`, { headers: authHeaders() });
    if (res.status === 200) {
      const data: any = await res.json();
      pass(`GET /api/status returns 200 (accessMode=${data.accessMode})`);
      embeddingsAvailable = data.indexingRunning !== undefined;
    } else {
      fail('GET /api/status', `expected 200, got ${res.status}: ${await res.text()}`);
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/status`);
    if (res.status === 401) {
      pass('GET /api/status without token returns 401');
    } else {
      fail('GET /api/status without token', `expected 401, got ${res.status}`);
    }

    // ========================================================
    // 2. Semantic edit -> reindex -> routing preview
    // ========================================================
    console.log('\n--- Semantic Edit -> Routing Preview ---');

    res = await fetch(`${baseUrl}${STUDIO_API}/semantics`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'products_get_all', phrase: 'list all products', lang: 'en' }),
    });
    let semData: any;
    try {
      semData = await res.json();
    } catch { semData = {}; }
    if (res.status === 200 && semData.id) {
      semanticId = semData.id;
      embeddingsAvailable = semData.hasEmbedding === true;
      pass(`POST /semantics creates phrase (id=${semData.id}, hasEmbedding=${semData.hasEmbedding})`);
    } else {
      fail('POST /semantics', `expected 200 with id, got ${res.status}: ${JSON.stringify(semData).substring(0, 100)}`);
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/semantics`, { headers: authHeaders() });
    try {
      const list = await res.json();
      if (Array.isArray(list)) {
        pass(`GET /semantics returns ${list.length} phrase(s)`);
      } else {
        fail('GET /semantics', `expected array, got ${JSON.stringify(list).substring(0, 80)}`);
      }
    } catch {
      fail('GET /semantics', `non-JSON response (${res.status})`);
    }

    if (semanticId) {
      res = await fetch(`${baseUrl}${STUDIO_API}/semantics/${semanticId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: 'show me every product in the catalog' }),
      });
      try {
        const updated = await res.json();
        if (res.status === 200 && updated.phrase === 'show me every product in the catalog') {
          pass('PATCH /semantics/:id updates phrase');
        } else {
          fail('PATCH /semantics/:id', `got ${res.status}: ${JSON.stringify(updated).substring(0, 80)}`);
        }
      } catch {
        fail('PATCH /semantics/:id', `non-JSON response (${res.status})`);
      }
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/routing/preview`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'list products' }),
    });
    try {
      const preview = await res.json();
      if (res.status === 200) {
        pass(`POST /routing/preview returns status=${preview.status} with ${(preview.matches ?? []).length} match(es)`);
      } else {
        fail('POST /routing/preview', `got ${res.status}`);
      }
    } catch {
      fail('POST /routing/preview', `non-JSON response (${res.status})`);
    }

    // ========================================================
    // 3. Document import -> knowledge search
    // ========================================================
    console.log('\n--- Document Import -> Knowledge Search ---');

    if (!embeddingsAvailable) {
      skip('Document import + knowledge search', 'Embedding service unavailable (Ollama not running)');
    } else {
      res = await fetch(`${baseUrl}${STUDIO_API}/documents/import`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'text',
          text: 'Najm is a TypeScript decorator-based web framework built on Hono.js. It provides dependency injection, guards, events, and MCP tool exposure for rapid API development.',
          namespace: 'rag',
        }),
      });
      try {
        const docData = await res.json();
        if (res.status === 200 && docData.documentId) {
          pass(`POST /documents/import creates document (id=${docData.documentId}, embedded=${docData.embedded}/${docData.embedded + docData.failed})`);
        } else {
          fail('POST /documents/import', `got ${res.status}: ${JSON.stringify(docData).substring(0, 100)}`);
        }
      } catch {
        fail('POST /documents/import', `non-JSON response (${res.status})`);
      }

      res = await fetch(`${baseUrl}${STUDIO_API}/knowledge/search`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'what is najm framework', limit: 5 }),
      });
      try {
        const searchData = await res.json();
        if (res.status === 200 && Array.isArray(searchData.citations)) {
          pass(`POST /knowledge/search returns ${searchData.citations.length} citation(s)`);
        } else {
          fail('POST /knowledge/search', `got ${res.status}`);
        }
      } catch {
        fail('POST /knowledge/search', `non-JSON response (${res.status})`);
      }
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/knowledge/status`, { headers: authHeaders() });
    try {
      const ksData = await res.json();
      if (res.status === 200 && typeof ksData.documents === 'number') {
        pass(`GET /knowledge/status (docs=${ksData.documents}, chunks=${ksData.chunks}, embeddings=${ksData.embeddings})`);
      } else {
        fail('GET /knowledge/status', `got ${res.status}`);
      }
    } catch {
      fail('GET /knowledge/status', `non-JSON response (${res.status})`);
    }

    // ========================================================
    // 4. Routing settings + audit logs
    // ========================================================
    console.log('\n--- Routing Settings & Audit ---');

    res = await fetch(`${baseUrl}${STUDIO_API}/settings`, { headers: authHeaders() });
    try {
      const settingsData = await res.json();
      if (res.status === 200) {
        pass(`GET /settings (maxTools=${settingsData.maxTools}, similarityThreshold=${settingsData.similarityThreshold}, enableKnowledge=${settingsData.enableKnowledge})`);
      } else {
        fail('GET /settings', `got ${res.status}`);
      }
    } catch {
      fail('GET /settings', `non-JSON response (${res.status})`);
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/settings`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ similarityThreshold: 0.55, maxTools: 8, enableKnowledge: true }),
    });
    try {
      const updatedSettings = await res.json();
      if (res.status === 200 && updatedSettings.similarityThreshold === 0.55 && updatedSettings.maxTools === 8 && updatedSettings.enableKnowledge === true) {
        pass('PATCH /settings updates live routing settings');
      } else {
        fail('PATCH /settings', `got ${res.status}: ${JSON.stringify(updatedSettings).substring(0, 80)}`);
      }
    } catch {
      fail('PATCH /settings', `non-JSON response (${res.status})`);
    }

    res = await fetch(`${baseUrl}${STUDIO_API}/settings/audit`, { headers: authHeaders() });
    try {
      const auditData = await res.json();
      if (res.status === 200 && Array.isArray(auditData)) {
        pass(`GET /settings/audit returns ${auditData.length} log entries`);
      } else {
        fail('GET /settings/audit', `got ${res.status}`);
      }
    } catch {
      fail('GET /settings/audit', `non-JSON response (${res.status})`);
    }

    // ========================================================
    // 5. Tools endpoint
    // ========================================================
    console.log('\n--- Tools ---');

    res = await fetch(`${baseUrl}${STUDIO_API}/tools`, { headers: authHeaders() });
    try {
      const toolsData = await res.json();
      if (res.status === 200) {
        pass(`GET /tools (indexed=${toolsData.indexed}, registered=${toolsData.registered})`);
      } else {
        fail('GET /tools', `got ${res.status}`);
      }
    } catch {
      fail('GET /tools', `non-JSON response (${res.status})`);
    }

    // ========================================================
    // 6. Semantics export
    // ========================================================
    console.log('\n--- Semantics Export ---');

    res = await fetch(`${baseUrl}${STUDIO_API}/semantics/export`, { headers: authHeaders() });
    try {
      const exportData = await res.json();
      if (res.status === 200 && Array.isArray(exportData.items)) {
        pass(`GET /semantics/export returns ${exportData.items.length} tool group(s)`);
      } else {
        fail('GET /semantics/export', `got ${res.status}`);
      }
    } catch {
      fail('GET /semantics/export', `non-JSON response (${res.status})`);
    }

    // ========================================================
    // 7. Cleanup
    // ========================================================
    console.log('\n--- Cleanup ---');

    if (semanticId) {
      res = await fetch(`${baseUrl}${STUDIO_API}/semantics/${semanticId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      try {
        const delData = await res.json();
        if (res.status === 200 && delData.deleted === true) {
          pass('DELETE /semantics/:id removes phrase');
        } else {
          fail('DELETE /semantics/:id', `got ${res.status}`);
        }
      } catch {
        fail('DELETE /semantics/:id', `non-JSON response (${res.status})`);
      }
    }

    // Reset settings
    await fetch(`${baseUrl}${STUDIO_API}/settings`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ similarityThreshold: 0.45, maxTools: 12, enableKnowledge: true }),
    });

  } finally {
    await server.stop();
  }

  // ========================================================
  // Summary
  // ========================================================
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n' + '='.repeat(50));
  console.log(`Studio Smoke Tests: ${passed}/${total} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }

  console.log('\n✅ All studio smoke tests passed.\n');
}

main().catch((err) => {
  console.error('Smoke test runner failed:', err);
  process.exit(1);
});
