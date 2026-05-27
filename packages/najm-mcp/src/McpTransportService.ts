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

    const resolveOrigin = (requestOrigin?: string): string => {
      if (!allowedOrigins) return '*';
      if (typeof allowedOrigins === 'string') return allowedOrigins;
      if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
      return allowedOrigins[0] ?? '*';
    };

    const setHeaders = (c: any) => {
      const origin = resolveOrigin(c.req.header('origin'));
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
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

      this.sseSessions.set(sessionId, { transport, server: mcpServer, alsSnapshot, createdAt: Date.now() });

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
      const sessionId = c.req.query('sessionId');
      const session = sessionId ? this.sseSessions.get(sessionId) : undefined;

      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
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
    const existing = c.get?.('mcp:auth') as McpAuthContext | undefined;
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
