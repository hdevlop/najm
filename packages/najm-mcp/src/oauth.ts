interface AuthCode {
  clientId: string;
  redirectUri: string;
  state?: string;
  expiresAt: number;
}

interface Client {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
}

export interface McpOAuthHandlers {
  protectedResource: () => Response;
  authServer: () => Response;
  register: (req: Request) => Promise<Response>;
  authorize: (req: Request) => Promise<Response>;
  token: (req: Request) => Promise<Response>;
}

/**
 * DEV-ONLY — In-memory OAuth stub for local development and testing.
 * NOT suitable for production use:
 * - No persistence (state lost on restart)
 * - No PKCE verification
 * - Static access token shared across all clients
 * - No rate limiting on endpoints
 *
 * For production, use a real OAuth provider (Auth0, Keycloak, etc.)
 * or the najm-auth plugin with proper JWT configuration.
 */
export function createOAuthHandlers(config: { issuer: string; token: string }): McpOAuthHandlers {
  const clients = new Map<string, Client>();
  const codes = new Map<string, AuthCode>();
  const { issuer, token } = config;

  return {
    protectedResource: () =>
      Response.json({ resource: issuer, authorization_servers: [issuer] }),

    authServer: () =>
      Response.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        registration_endpoint: `${issuer}/oauth/register`,
        scopes_supported: ['mcp'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      }),

    register: async (req) => {
      const body = await req.json().catch(() => ({}));
      const clientId = crypto.randomUUID();
      clients.set(clientId, {
        clientId,
        redirectUris: body.redirect_uris ?? [],
        clientName: body.client_name,
      });
      return Response.json({ client_id: clientId, ...body }, { status: 201 });
    },

    authorize: async (req) => {
      const url = new URL(req.url);

      if (req.method === 'GET') {
        const clientId = url.searchParams.get('client_id') ?? '';
        const clientName = clients.get(clientId)?.clientName ?? clientId;
        const redirectUri = url.searchParams.get('redirect_uri') ?? '';
        const state = url.searchParams.get('state') ?? '';
        return new Response(approveHtml(clientName, clientId, redirectUri, state), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const form = await req.formData();
      const action = form.get('action') as string;
      const clientId = form.get('client_id') as string;
      const redirectUri = form.get('redirect_uri') as string;
      const state = (form.get('state') as string) ?? '';
      const dest = new URL(redirectUri);

      if (action !== 'allow') {
        dest.searchParams.set('error', 'access_denied');
        if (state) dest.searchParams.set('state', state);
        return Response.redirect(dest.toString(), 302);
      }

      const code = crypto.randomUUID().replace(/-/g, '');
      codes.set(code, { clientId, redirectUri, state, expiresAt: Date.now() + 5 * 60_000 });
      dest.searchParams.set('code', code);
      if (state) dest.searchParams.set('state', state);
      return Response.redirect(dest.toString(), 302);
    },

    token: async (req) => {
      // Sweep expired authorization codes to prevent unbounded growth
      const now = Date.now();
      if (codes.size > 50) {
        for (const [k, v] of codes) {
          if (now > v.expiresAt) codes.delete(k);
        }
      }

      const ct = req.headers.get('content-type') ?? '';
      let body: Record<string, string>;
      if (ct.includes('application/json')) {
        body = await req.json();
      } else {
        const fd = await req.formData();
        body = Object.fromEntries(fd.entries()) as Record<string, string>;
      }

      const code = body['code'];
      const entry = code ? codes.get(code) : undefined;
      if (!entry || now > entry.expiresAt) {
        codes.delete(code ?? '');
        return Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
      codes.delete(code!);
      return Response.json({ access_token: token, token_type: 'Bearer', scope: 'mcp' });
    },
  };
}

function approveHtml(
  clientName: string,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const safe = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html>
<head>
  <title>Allow MCP Access</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 100px auto; padding: 20px; }
    h2   { margin-bottom: 8px; }
    p    { color: #555; margin-bottom: 24px; }
    .row { display: flex; gap: 12px; }
    button { padding: 10px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .allow { background: #0070f3; color: #fff; }
    .deny  { background: #eee; color: #333; }
  </style>
</head>
<body>
  <h2>Allow access?</h2>
  <p><strong>${safe(clientName)}</strong> wants to access your MCP server.</p>
  <form method="POST">
    <input type="hidden" name="client_id"    value="${safe(clientId)}">
    <input type="hidden" name="redirect_uri" value="${safe(redirectUri)}">
    <input type="hidden" name="state"        value="${safe(state)}">
    <div class="row">
      <button type="submit" name="action" value="allow" class="allow">Allow</button>
      <button type="submit" name="action" value="deny"  class="deny">Deny</button>
    </div>
  </form>
</body>
</html>`;
}
