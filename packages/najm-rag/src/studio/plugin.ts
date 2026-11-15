import { plugin } from 'najm-core';
import { RAG_STUDIO_OPTS } from './tokens';
import { SemanticsController } from './SemanticsController';
import { KnowledgeController } from './KnowledgeController';
import { RoutingTestsController } from './RoutingTestsController';
import { ToolManagementController } from './ToolManagementController';
import { StudioSettingsController } from './StudioSettingsController';
import { StudioAuditService } from './StudioAuditService';
import { StudioAssistantController } from './StudioAssistantController';

export interface RagStudioOptions {
  /**
   * Deprecated no-op. This plugin serves the API only; mount the UI from
   * `najm-rag/studio` in the host app.
   */
  ui?: boolean;
  /**
   * Documentation only: the server never reads it. Every studio route is
   * `@isAdmin()`-gated through najm-auth, which accepts the host session or a
   * Bearer token either way. How the UI signs in is chosen on the client, by
   * `<RagStudioProvider auth="session" | "standalone">`. Kept in
   * `RAG_STUDIO_OPTS` for code that already reads it.
   * - `'session'`: the UI uses the host app's session (embedded). Default.
   * - `'standalone'`: the UI logs in itself and sends a Bearer token.
   */
  auth?: 'session' | 'standalone';
  /**
   * Register the Studio Assistant controller. Requires najm-chatbot's
   * `studioAssistant()` plugin to be registered (it provides the assistant
   * provider). Default: `false`, so the studio needs no chatbot plugin.
   */
  assistant?: boolean;
}

/**
 * Registers the RAG Studio admin API on top of a `rag()` engine. All controllers
 * are `@isAdmin()` gated. The UI is `<RagStudio />` from `najm-rag/studio`.
 *
 * Requires `rag`, `auth`, and `database` plugins to already be registered.
 * With `assistant: true`, `chatbot-studio-assistant` from `najm-chatbot`'s
 * `studioAssistant()` must also be registered.
 *
 * ```ts
 * new Server()
 *   .use(rag({ ... }))
 *   .use(ragStudio())   // admin API at /rag-studio
 * ```
 */
export const ragStudio = (opts?: RagStudioOptions) => {
  const services: any[] = [
    SemanticsController,
    KnowledgeController,
    RoutingTestsController,
    ToolManagementController,
    StudioSettingsController,
    StudioAuditService,
  ];

  const assistantEnabled = opts?.assistant === true;
  if (assistantEnabled) services.push(StudioAssistantController);

  const required = ['rag', 'auth', 'database'];
  if (assistantEnabled) required.push('chatbot-studio-assistant');

  return plugin('rag-studio')
    .version('1.0.0')
    .requires(...required)
    .services(...services)
    .set(RAG_STUDIO_OPTS, {
      auth: opts?.auth ?? 'session',
      ui: false,
    })
    .build();
};
