import { APP, BASE_PATH, Container, DI, Inject, LoggerService, Meta, Service } from 'najm-core';
import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { DATA, FILTER, INFO, OWNER, PERMISSIONS, ROLE, USER } from 'najm-guard';
import { MCP_CONFIG } from './tokens';
import type { McpAuthContext, McpConfig, McpCorsConfig, McpTransport } from './types';
import { McpBuilderService } from './McpBuilderService';
import { McpRegistryService } from './McpRegistryService';
import { createOAuthHandlers } from './oauth';

@Service()
@Meta({ layer: 'plugin', order: 41 })
export class McpTransportService {
  @DI() private container!: Container;
  @Inject(APP) private app!: Hono;
  @Inject(BASE_PATH) private basePath!: string;
  @Inject(MCP_CONFIG) private config!: McpConfig;
  @Inject() private builder!: McpBuilderService;
  @Inject() private registry!: McpRegistryService;
  @Inject(LoggerService) private log!: LoggerService;

  private sseSessions = new Map<string, {
    transport: SSEServerTransport;
    server: ReturnType<McpBuilderService['createServer']>;
    alsSnapshot?: Record<string, any>;
    userId?: string;
    createdAt: number;
  }>();

  async activate(): Promise<void> {
    const path = this.resolvePath();
    const transports = this.resolveTransports();
    const httpTransports = transports.filter((transport) => transport !== 'stdio');

    this.mountOAuth();
    this.mountCors(path);
    this.mountCustomAuth(path);

    if (httpTransports.includes('http')) {
      this.mountStreamableHttp(path, httpTransports);
    }

    if (httpTransports.includes('sse')) {
      this.mountSse(path);
    }
  }

  async onReady(): Promise<void> {
    const path = this.resolvePath();
    const transports = this.resolveTransports();

    this.log.info(`MCP plugin ready: ${this.config.name}@${this.config.version}`);
    this.log.info(`MCP path: ${path}`);
    this.log.info(`MCP transports: ${transports.join(', ')}`);

    if (transports.includes('stdio')) {
      this.log.info('MCP stdio enabled: call serveMcpStdio(server) in your CLI entrypoint');
      this.log.info('MCP stdio client config: { "command": "bun", "args": ["run", "src/mcp-stdio.ts"] }');
    }
  }

  private resolveOAuth(): { issuer: string; token: string } | undefined {
    if (!this.config.oauth) return undefined;

    const explicit = typeof this.config.oauth === 'object' ? this.config.oauth : {};
    const issuer = explicit.issuer ?? process.env.MCP_ISSUER;
    const token = explicit.token ?? process.env.MCP_OAUTH_TOKEN;

    if (!issuer || !token) {
      this.log.warn('MCP OAuth enabled but missing issuer/token. Set MCP_ISSUER and MCP_OAUTH_TOKEN env vars.');
      return undefined;
    }

    return { issuer, token };
  }

  private mountOAuth(): void {
    const oauth = this.resolveOAuth();
    if (!oauth) return;

    // The OAuth stub is DEV-ONLY: it authenticates nobody and exchanges any
    // code for a static token. Refuse to mount it in production unless the
    // caller explicitly opts in via oauth.unsafeDevStub.
    const unsafeOptIn = typeof this.config.oauth === 'object' && this.config.oauth.unsafeDevStub === true;
    if (process.env.NODE_ENV === 'production' && !unsafeOptIn) {
      this.log.error?.(
        '[najm-mcp] OAuth dev stub NOT mounted in production — it authenticates nobody and issues a static token. ' +
        'Use a real OAuth provider or najm-auth. To override (NOT recommended), set oauth.unsafeDevStub = true.',
      );
      return;
    }

    this.log.warn(
      '[najm-mcp] Mounting DEV-ONLY OAuth stub: no real authentication, static access token, in-memory codes. ' +
      'Do NOT use in production.',
    );

    const handlers = createOAuthHandlers(oauth);
    const basePath = this.basePath ?? '';

    this.app.get(`${basePath}/.well-known/oauth-protected-resource`, () => handlers.protectedResource());
    this.app.get(`${basePath}/.well-known/oauth-authorization-server`, () => handlers.authServer());
    this.app.post(`${basePath}/oauth/register`, (c: any) => handlers.register(c.req.raw));
    this.app.get(`${basePath}/oauth/authorize`, (c: any) => handlers.authorize(c.req.raw));
    this.app.post(`${basePath}/oauth/authorize`, (c: any) => handlers.authorize(c.req.raw));
    this.app.post(`${basePath}/oauth/token`, (c: any) => handlers.token(c.req.raw));
  }

  private mountCustomAuth(path: string): void {
    const auth = this.config.auth;
    if (!auth) return;

    const middleware = async (c: any, next: any) => {
      if (c.req.method === 'OPTIONS') {
        return next();
      }

      const token = this.extractAuthToken(c, auth.type);
      if (!token) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const result = await auth.validate(token);
      if (!result) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (typeof result === 'object') {
        c.set('mcp:auth', result as McpAuthContext);

        return this.withAlsSnapshot(result, next);
      }

      // Boolean success: record it so resolveRequestAuthContext does not
      // re-run validate() for the same request (authenticated, no context).
      c.set('mcp:auth', true);
      return next();
    };

    this.app.use(path, middleware);
    this.app.use(`${path}/*`, middleware);
  }

  private mountCors(path: string): void {
    if (this.config.cors === false) {
      return;
    }

    const corsConfig: McpCorsConfig = typeof this.config.cors === 'object' ? this.config.cors : {};
    const allowedOrigins = corsConfig.origin;
    const credentials = corsConfig.credentials ?? false;

    // `credentials: true` with a wildcard/absent origin is invalid CORS
    // (browsers reject `*` + credentials) and masks intent. Fail at boot.
    if (credentials && (!allowedOrigins || allowedOrigins === '*')) {
      throw new Error(
        '[najm-mcp] CORS misconfiguration: cors.credentials=true requires an explicit cors.origin ' +
        '(string or list); it cannot be combined with a wildcard or absent origin.',
      );
    }

    // Returns the origin to grant, or undefined when the request origin is not
    // allowed (in which case NO Access-Control-Allow-Origin header is sent).
    const resolveOrigin = (requestOrigin?: string): string | undefined => {
      if (!allowedOrigins) return '*';
      if (typeof allowedOrigins === 'string') return allowedOrigins;
      if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
      return undefined;
    };

    const setHeaders = (c: any) => {
      const origin = resolveOrigin(c.req.header('origin'));
      if (origin !== undefined) {
        c.header('Access-Control-Allow-Origin', origin);
      }
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
      // The granted origin depends on the request origin only when a list is
      // configured; static '*'/single-origin responses do not need Vary.
      if (Array.isArray(allowedOrigins)) {
        c.header('Vary', 'Origin');
      }
      if (credentials) {
        c.header('Access-Control-Allow-Credentials', 'true');
      }
    };

    const middleware = async (c: any, next: any) => {
      setHeaders(c);

      if (c.req.method === 'OPTIONS') {
        return c.body(null, 204);
      }

      return next();
    };

    this.app.use(path, middleware);
    this.app.use(`${path}/*`, middleware);
    this.app.options(path, (c: any) => {
      setHeaders(c);
      return c.body(null, 204);
    });
    this.app.options(`${path}/*`, (c: any) => {
      setHeaders(c);
      return c.body(null, 204);
    });
  }

  private mountStreamableHttp(path: string, transports: McpTransport[]): void {
    this.app.get(path, (c: any) => {
      return c.json({
        name: this.config.name,
        version: this.config.version,
        protocol: 'mcp',
        transports,
      });
    });

    this.app.get(`${path}/tools`, (c: any) => {
      return c.json({
        name: this.config.name,
        version: this.config.version,
        tools: this.registry.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          group: tool.group,
          localName: tool.localName,
          args: this.resolveDiscoveryArgs(tool),
          annotations: tool.annotations,
          confirmation: tool.confirmation,
        })),
      });
    });

    this.app.post(path, async (c: any) => {
      const maxBody = this.config.maxBodySize ?? 1_048_576;
      const contentLength = parseInt(c.req.header('content-length') ?? '0', 10);
      if (maxBody > 0 && contentLength > maxBody) {
        return c.json({ error: 'Request body too large' }, 413);
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
        enableDnsRebindingProtection: this.config.enableDnsRebindingProtection ?? false,
        ...(this.config.allowedHosts ? { allowedHosts: this.config.allowedHosts } : {}),
        ...(this.config.allowedOrigins ? { allowedOrigins: this.config.allowedOrigins } : {}),
      });
      const mcpServer = this.builder.createServer();
      const authContext = await this.resolveRequestAuthContext(c);
      const alsSnapshot = this.captureAlsSnapshot(authContext);

      const body = await c.req.json().catch(() => undefined);

      try {
        const runRequest = async () => {
          await mcpServer.connect(transport as any);
          return transport.handleRequest(c.req.raw, { parsedBody: body });
        };

        if (alsSnapshot) {
          return await this.withAlsSnapshot({ requestId: randomUUID(), ...alsSnapshot }, runRequest);
        }

        return await runRequest();
      } finally {
        await transport.close().catch(() => undefined);
        await mcpServer.close().catch(() => undefined);
      }
    });
  }

  private resolveDiscoveryArgs(tool: any): string[] {
    return Array.from(new Set([...(tool.validationParamKeys ?? []), ...(tool.validationArgs ?? [])]));
  }

  private mountSse(path: string): void {
    this.app.get(`${path}/sse`, async (c: any) => {
      this.sweepStaleSessions();

      const maxSessions = this.config.sse?.maxSessions ?? 1000;
      if (this.sseSessions.size >= maxSessions) {
        return c.json({ error: 'Too many active sessions' }, 503);
      }

      const transport = new SSEServerTransport(`${path}/messages`, c.res);
      const sessionId = (transport as any).sessionId as string;
      const mcpServer = this.builder.createServer();
      const authContext = await this.resolveRequestAuthContext(c);
      const alsSnapshot = this.captureAlsSnapshot(authContext);
      // Bind the session to the authenticated user so later POST /messages
      // calls can be verified against the caller. Without config.auth, the
      // najm-auth Bearer fallback still captures a snapshot here; the
      // per-message check below keeps that snapshot from being drivable by
      // anyone who merely knows the sessionId.
      const userId = this.extractUserId(authContext);

      this.sseSessions.set(sessionId, { transport, server: mcpServer, alsSnapshot, userId, createdAt: Date.now() });

      (transport as any).onclose = () => {
        void mcpServer.close().catch(() => undefined);
        this.sseSessions.delete(sessionId);
      };

      try {
        if (alsSnapshot) {
          await this.withAlsSnapshot({ requestId: randomUUID(), ...alsSnapshot }, async () => {
            await mcpServer.connect(transport as any);
          });
        } else {
          await mcpServer.connect(transport as any);
        }

        return c.res;
      } catch (error) {
        this.sseSessions.delete(sessionId);
        await mcpServer.close().catch(() => undefined);
        this.log.error?.('MCP SSE connection failed', error);
        throw error;
      }
    });

    this.app.post(`${path}/messages`, async (c: any) => {
      // Expired sessions (and their captured auth snapshots) are otherwise only
      // reaped when a new GET /sse arrives; sweep here too so an idle server
      // does not retain them indefinitely.
      this.sweepStaleSessions();

      // Prefer the session id from a header so it stays out of proxy/access
      // logs; fall back to the query param for SDK clients that only send it there.
      const sessionId = c.req.header('mcp-session-id') ?? c.req.query('sessionId');
      const session = sessionId ? this.sseSessions.get(sessionId) : undefined;

      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }

      // Per-message binding: an authenticated session must only be driven by
      // the same authenticated user. Knowing the sessionId is not sufficient.
      if (session.alsSnapshot) {
        const callerContext = await this.resolveRequestAuthContext(c);
        if (!callerContext) {
          return c.json({ error: 'Unauthorized' }, 401);
        }
        const callerId = this.extractUserId(callerContext);
        if (session.userId !== undefined && callerId !== session.userId) {
          return c.json({ error: 'Forbidden' }, 403);
        }
      }

      const handler = async () => {
        const response = await (session.transport as any).handlePostMessage(c.req.raw, c.res);
        return response ?? c.res;
      };

      return session.alsSnapshot
        ? this.withAlsSnapshot({ requestId: randomUUID(), ...session.alsSnapshot }, handler)
        : handler();
    });
  }

  private sweepStaleSessions(): void {
    const maxAge = this.config.sse?.sessionTtl ?? 30 * 60_000;
    const now = Date.now();

    for (const [id, session] of this.sseSessions) {
      if (now - session.createdAt > maxAge) {
        void session.transport.close?.().catch(() => undefined);
        void session.server.close().catch(() => undefined);
        this.sseSessions.delete(id);
      }
    }
  }

  private async withAlsSnapshot<T>(data: Record<string, any>, fn: () => Promise<T> | T): Promise<T> {
    const als = (this.container as any).store?.als;
    if (!als || typeof als.run !== 'function') {
      return await fn();
    }

    const currentStore = als.getStore?.();
    const nextStore = new Map<string, any>(currentStore);

    for (const [key, value] of Object.entries(data)) {
      nextStore.set(key, value);
    }

    return als.run(nextStore, fn);
  }

  private captureAlsSnapshot(authContext?: Record<string, any>): Record<string, any> | undefined {
    const snapshot: Record<string, any> = authContext ? { ...authContext } : {};

    this.copyTokenValue(snapshot, 'user', USER);
    this.copyTokenValue(snapshot, 'owner', OWNER);
    this.copyTokenValue(snapshot, 'info', INFO);
    this.copyTokenValue(snapshot, 'data', DATA);
    this.copyTokenValue(snapshot, 'filter', FILTER);
    this.copyTokenValue(snapshot, 'role', ROLE);
    this.copyTokenValue(snapshot, 'permissions', PERMISSIONS);

    return Object.keys(snapshot).length > 0 ? snapshot : undefined;
  }

  private async resolveRequestAuthContext(c: any): Promise<McpAuthContext | undefined> {
    const existing = c.get?.('mcp:auth') as McpAuthContext | true | undefined;
    // `true` means the request authenticated with no user context — already
    // validated by the custom-auth middleware; do not re-validate.
    if (existing === true) return undefined;
    if (existing) return existing;

    const auth = this.config.auth;

    if (auth) {
      const token = this.extractAuthToken(c, auth.type);
      if (!token) return undefined;

      const result = await auth.validate(token);
      return result && typeof result === 'object' ? result as McpAuthContext : undefined;
    }

    const bearer = this.extractAuthToken(c, 'bearer');
    if (!bearer) return undefined;

    try {
      const authModule = await import('najm-auth');
      const AuthResolver = (authModule as any).AuthResolver;
      if (!AuthResolver) return undefined;

      const resolver = await this.container.resolve(AuthResolver as any) as { resolve(token: string): Promise<any> };
      const result = await resolver.resolve(bearer);

      return result && typeof result === 'object' ? result as McpAuthContext : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Best-effort extraction of a stable user identifier from an auth context,
   * used to bind SSE sessions to a single user. Accepts the common shapes:
   * `{ user: { id | userId | sub } }`, a primitive `user`, or top-level
   * `userId`/`sub`.
   */
  private extractUserId(ctx?: Record<string, any>): string | undefined {
    if (!ctx) return undefined;

    const user = ctx.user;
    const candidate = user && typeof user === 'object'
      ? (user.id ?? user.userId ?? user.sub)
      : (user ?? ctx.userId ?? ctx.sub);

    return candidate != null ? String(candidate) : undefined;
  }

  private copyTokenValue(snapshot: Record<string, any>, key: string, token: any): void {
    if (snapshot[key] !== undefined) return;

    const value = this.container.get(token);
    if (value !== undefined) {
      snapshot[key] = value;
    }
  }

  private resolveTransports(): McpTransport[] {
    return this.config.transports?.length ? this.config.transports : ['http'];
  }

  private resolvePath(): string {
    const pluginPath = this.config.path ?? '/mcp';
    return this.joinPaths(this.basePath ?? '', pluginPath);
  }

  private joinPaths(...segments: string[]): string {
    const path = segments
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/(.+)\/$/, '$1');

    return path.startsWith('/') ? path : `/${path}`;
  }

  private extractAuthToken(c: any, authType: 'bearer' | 'api-key'): string | undefined {
    if (authType === 'api-key') {
      return c.req.header('x-api-key') ?? undefined;
    }

    const raw = c.req.header('authorization') ?? '';
    if (!raw) {
      return undefined;
    }

    return raw.replace(/^Bearer\s+/i, '').trim();
  }
}
