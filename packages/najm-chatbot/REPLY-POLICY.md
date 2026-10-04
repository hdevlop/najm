# Reply languages and templates

`chatbot({ reply })` is opt-in and applies to web, WhatsApp, one-shot and debug
chat, independently of the selected provider/model. Existing applications keep
their behavior when `reply` is absent.

```ts
import { chatbot, detectMoroccanReplyLanguage } from 'najm-chatbot';

chatbot({
  reply: {
    detectLanguage: detectMoroccanReplyLanguage,
    template: ({ userText, language }) => {
      // App-owned intent recognition and translated text. Unknown requests
      // return null and continue through the configured model.
      return null;
    },
  },
});
```

The conservative Moroccan profile recognizes Darija (Arabic script or common
Arabizi), formal Arabic and French. Quoted text is excluded from hints; stored
names/results are never normalized or translated. Unsupported languages receive
no additional instruction. A custom `detectLanguage` can select one of the
supported languages explicitly using app-owned preferences.

Language and template selection use the latest user message. Routing and
knowledge still receive conversation history. Context providers may read the
optional second argument `{ latestUserText, channel }` for request-specific
policy while keeping their existing first argument for knowledge retrieval.

Templates return either `{ text }` (e.g. a localized unavailable-write reply),
or `{ calls: [{ name, input }], render(results) }`. Read plans use only tools
available to that turn and explicitly annotated `readOnly: true`, without
confirmation or destructive annotations. Every invocation still passes through
MCP validation, guards, ownership and invocation scope. All calls are checked
before the first executes. `render` must validate the actual returned data and
must not turn missing/failed reads into zero counts. Errors produce localized
unavailability and `diagnostics.reply.error`, without model fallback or partial
fact guesses. No retries or translation requests are added.

Template replies emit the normal AI SDK UI stream, including successful tool
inputs/results, and persist the actual assistant text under the same memory
policy. Diagnostics identify `reply.source: 'template'` versus `'model'`;
template token usage and model cost are zero. `diagnostics.model` still names the
selected setting, not an LLM that ran. Existing routing/embedding costs still
apply. Long free-form answers remain model-dependent and require evaluation
after a model change; these heuristics do not establish native Darija fluency.

Apps own domain intents, exact templates, business rules and tool arguments.
Najm owns language instructions, safe execution, stream framing and diagnostics.
