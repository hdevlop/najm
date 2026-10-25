import { z } from 'zod';
import { canonicalJson, sha256, sameContext, type ReplicaRecord, type SyncContext } from 'najm-database/sync/contracts';
import type { SnapshotManifest } from 'najm-database/sync/client';
import { OFFLINE_DURATION_MS, OFFLINE_PROTOCOL, OFFLINE_SCHEMA, OFFLINE_SHARED_YEAR, projectionId,
  type OfflineGrant, type OfflineInstallation, type ReadProjection } from '../index';

/**
 * Why the server refused an offline request. The app maps each to its own
 * translated message (School: `offlineRead.errors.<reason>`).
 */
export const OFFLINE_REFUSALS = ['disabled', 'notPermitted', 'accountChanged', 'settingsRequired',
  'authorizationChanged', 'snapshotExpired', 'scopeMismatch', 'pageNotFound', 'pageLimit'] as const;
export type OfflineRefusal = typeof OFFLINE_REFUSALS[number];
/** Throws the app's HTTP error. */
export type Refuse = (status: number, reason: OfflineRefusal) => never;

export const OFFLINE_PAGE_RECORDS = 500;
export const OFFLINE_PAGE_BYTES = 1_048_576;
/** How long a download's pages stay readable after it is created. */
export const OFFLINE_SNAPSHOT_TTL_MS = 5 * 60_000;

const generationPattern = /^[a-f0-9]{64}$/;
export const installationDto = z.object({ installationId: z.uuid(), installationEpoch: z.uuid() }).strict();
export const snapshotDto = installationDto.extend({
  kind: z.enum(['shared', 'year']),
  authorizationGeneration: z.string().regex(generationPattern),
}).strict();
export const pageDto = z.object({ id: z.string().regex(/^\d+$/), page: z.coerce.number().int().min(0).max(10000) });
export const pageQuery = installationDto.extend({ authorizationGeneration: z.string().regex(generationPattern) }).strict();
export type SnapshotInput = z.infer<typeof snapshotDto>;
export type PageInput = z.infer<typeof pageQuery>;

/** Enforced by both server and browser; an oversized single response is refused. */
export function splitReadPages(records: ReplicaRecord[], refuse: Refuse, limits = { records: OFFLINE_PAGE_RECORDS, bytes: OFFLINE_PAGE_BYTES }): ReplicaRecord[][] {
  const encoder = new TextEncoder();
  const pages: ReplicaRecord[][] = [];
  let page: ReplicaRecord[] = [];
  // canonicalJson(page) is '[' + records joined by ',' + ']': each record is
  // encoded once and the page's size is kept as a running total.
  let bytes = 2;
  for (const record of records) {
    const size = encoder.encode(canonicalJson([record])).length - 2;
    if (size + 2 > limits.bytes) refuse(413, 'pageLimit');
    if (page.length === limits.records || bytes + (page.length ? 1 : 0) + size > limits.bytes) {
      pages.push(page); page = []; bytes = 2;
    }
    bytes += (page.length ? 1 : 0) + size;
    page.push(record);
  }
  if (page.length) pages.push(page);
  return pages;
}

/**
 * The account as offline access sees it. `ownership` is anything else whose
 * change must invalidate every retained copy at the next renewal, such as the
 * relationships an ownership rule follows.
 */
export type OfflineActor = {
  id: string; name: string | null; email: string | null; image: string | null;
  status: string | null; role: string; permissions: string[]; ownership?: unknown;
};

/** Changes whenever the account's identity, role, permissions or ownership change. */
export function authorizationGeneration(actor: Pick<OfflineActor, 'id' | 'role' | 'permissions' | 'ownership'>) {
  return sha256(canonicalJson({ id: actor.id, role: actor.role, permissions: actor.permissions, ownership: actor.ownership }));
}

export type ActorCheck = {
  /** The app's switch (`offlineEnabled(process.env.X)`), read at request time. */
  enabled: boolean;
  lookup(id: string): Promise<OfflineActor | null | undefined>;
  /** The account the request's session authenticated. */
  requestActor: { id?: string; role?: string | null } | null | undefined;
  /** Every one is required, checked against the stored role, not the token. */
  permissions: readonly string[];
  can(permission: string, granted: string[]): boolean;
  refuse: Refuse;
};
/** Turned off, every grant and download is refused before any lookup: clients lock what they hold. */
export async function authorizeActor(id: string, check: ActorCheck): Promise<OfflineActor> {
  if (!check.enabled) check.refuse(403, 'disabled');
  const actor = await check.lookup(id);
  if (!actor || actor.status !== 'active') check.refuse(403, 'notPermitted');
  if (check.requestActor?.id !== actor.id || check.requestActor.role !== actor.role) check.refuse(403, 'accountChanged');
  for (const permission of check.permissions) {
    if (!check.can(permission, actor.permissions)) check.refuse(403, 'notPermitted');
  }
  return actor;
}

export type GrantInput = {
  installation: OfflineInstallation;
  actor: OfflineActor;
  /** Year labels the account may download, one `year:<label>` scope each. */
  years: readonly string[];
  activeYear: string;
  /** Capabilities of every year scope (School: read:students, and read:classes when granted). */
  capabilities: readonly string[];
  /** Capabilities of the shared scope. */
  sharedCapabilities: readonly string[];
  /** The account's enumerated read permissions; admin wildcards are never retained. */
  readPermissions: readonly string[];
  /** The permission that admits offline use. Defaults to `read:offline`. */
  offlinePermission?: string;
  durationMs?: number;
};
export async function buildGrant(input: GrantInput): Promise<OfflineGrant> {
  const { actor } = input;
  const issuedAt = Date.now();
  return { ...input.installation, protocol: OFFLINE_PROTOCOL, schema: OFFLINE_SCHEMA, accountId: actor.id,
    authorizationGeneration: await authorizationGeneration(actor), issuedAt, validUntil: issuedAt + (input.durationMs ?? OFFLINE_DURATION_MS),
    scopes: [{ id: 'shared', academicYear: OFFLINE_SHARED_YEAR, capabilities: [...input.sharedCapabilities] },
      ...input.years.map(year => ({ id: 'year:' + year, academicYear: year, capabilities: [...input.capabilities] }))],
    account: { id: actor.id, name: actor.name, email: actor.email, image: actor.image, role: actor.role },
    // Only enumerated read capabilities are used for cached presentation; never retain admin wildcards.
    permissions: [...new Set([input.offlinePermission ?? 'read:offline', ...input.readPermissions, ...input.capabilities])], activeYear: input.activeYear };
}

/** Immutable, short-lived downloads, stored by the app (see `najm-offline/pg`). */
export type SnapshotRow = { id: bigint | string; accountId: string; context: SyncContext; pages: ReplicaRecord[][]; expiresAt: string };
export type SnapshotStore = {
  create(accountId: string, context: SyncContext): Promise<Pick<SnapshotRow, 'id' | 'expiresAt'>>;
  save(id: SnapshotRow['id'], pages: ReplicaRecord[][]): Promise<void>;
  find(id: string, accountId: string): Promise<Pick<SnapshotRow, 'context' | 'pages' | 'expiresAt'> | null | undefined>;
  cleanup(): Promise<void>;
};

/** Records what each path answers, in the shape its live route returns. */
export type ProjectionRecorder = (path: string, body: unknown) => void;
export type SnapshotRequest = {
  store: SnapshotStore;
  actor: OfflineActor;
  input: SnapshotInput;
  /** The request's year scope, read only for a year download (a shared one may carry none). */
  yearLabel(): string;
  language: string;
  refuse: Refuse;
  project(add: ProjectionRecorder, kind: SnapshotInput['kind']): Promise<void>;
};
/** Run inside one repeatable-read transaction, so every projection reads one database state. */
export async function createSnapshot(request: SnapshotRequest): Promise<SnapshotManifest> {
  const { actor, input, store } = request;
  const generation = await authorizationGeneration(actor);
  if (generation !== input.authorizationGeneration) request.refuse(409, 'authorizationChanged');
  const context: SyncContext = { installationId: input.installationId, installationEpoch: input.installationEpoch,
    accountId: actor.id, authorizationGeneration: generation, replicaSchemaVersion: OFFLINE_SCHEMA,
    scope: input.kind === 'shared' ? { kind: 'shared' } : { kind: 'year', yearLabel: request.yearLabel() } };
  const row = await store.create(actor.id, context);
  const revision = row.id.toString();
  const downloadedAt = Date.now();
  const records: ReplicaRecord<ReadProjection>[] = [];
  const add: ProjectionRecorder = (path, body) => records.push({ entity: 'projection', id: projectionId(request.language, path),
    revision, deleted: false, value: { path, language: request.language, downloadedAt, body: JSON.parse(JSON.stringify(body)) } });
  await request.project(add, input.kind);
  const pages = splitReadPages(records, request.refuse);
  await store.save(row.id, pages);
  return { generation: revision, context, cursor: revision,
    expiresAt: new Date(row.expiresAt).getTime(), recordCount: records.length,
    pageChecksums: await Promise.all(pages.map(page => sha256(canonicalJson(page)))) };
}

export type PageRequest = {
  store: SnapshotStore;
  actor: OfflineActor;
  snapshotId: string;
  page: number;
  input: PageInput;
  /** Read only for a year download's page. */
  yearLabel(): string;
  refuse: Refuse;
};
/** One page of a download, only to the account, installation and year scope that created it. */
export async function readSnapshotPage(request: PageRequest): Promise<ReplicaRecord[]> {
  const { actor, input } = request;
  if (await authorizationGeneration(actor) !== input.authorizationGeneration) request.refuse(403, 'authorizationChanged');
  const snapshot = await request.store.find(request.snapshotId, actor.id);
  if (!snapshot || new Date(snapshot.expiresAt).getTime() <= Date.now()) request.refuse(404, 'snapshotExpired');
  const expected = { ...snapshot.context, ...input, accountId: actor.id,
    scope: snapshot.context.scope.kind === 'shared' ? { kind: 'shared' as const } : { kind: 'year' as const, yearLabel: request.yearLabel() } };
  if (!sameContext(snapshot.context, expected)) request.refuse(403, 'scopeMismatch');
  if (!snapshot.pages[request.page]) request.refuse(404, 'pageNotFound');
  return snapshot.pages[request.page];
}
