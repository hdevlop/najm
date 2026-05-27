import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { eq, isNull, sql, and, like, inArray } from 'drizzle-orm';
import { VECTOR_STRATEGY } from '../tokens';
import type { VectorStrategy } from '../vectorStore';
import { decodeF32 } from '../vectorStore';
import type { SemanticMatch, SemanticPhraseRow, SemanticGroup, SemanticGroupsResult, ToolEmbeddingRow, UpsertEmbeddingData, UpsertSemanticData } from './ToolIndexDto';
import { ToolIndexValidator } from './ToolIndexValidator';

@Repository()
export class ToolIndexRepository {
  @DB() declare db: any;
  @Inject(VECTOR_STRATEGY) private vectors!: VectorStrategy;
  @Inject() private validator!: ToolIndexValidator;
  private semanticsSchemaChecked = false;
  private semanticsSchemaCheck: Promise<void> | null = null;

  async listEmbeddings(): Promise<ToolEmbeddingRow[]> {
    return this.db.select().from(this.validator.embeddingsTable());
  }

  async findEmbeddingByToolName(toolName: string): Promise<ToolEmbeddingRow | null> {
    const [row] = await this.db
      .select()
      .from(this.validator.embeddingsTable())
      .where(eq(this.validator.embeddingsTable().toolName, toolName))
      .limit(1);
    return row ?? null;
  }

  async upsertEmbedding(data: UpsertEmbeddingData): Promise<void> {
    const table = this.validator.embeddingsTable();
    const existing = await this.findEmbeddingByToolName(data.toolName);
    const encodedEmbedding = this.vectors.encodeEmbedding(data.embedding);

    if (existing) {
      await this.db
        .update(table)
        .set({
          description: data.description,
          group: data.group ?? null,
          localName: data.localName ?? null,
          argNames: data.argNames ?? null,
          annotations: data.annotations ?? null,
          fingerprint: data.fingerprint,
          embedding: encodedEmbedding,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(table.id, existing.id));
    } else {
      await this.db.insert(table).values({
        toolName: data.toolName,
        description: data.description,
        group: data.group ?? null,
        localName: data.localName ?? null,
        argNames: data.argNames ?? null,
        annotations: data.annotations ?? null,
        fingerprint: data.fingerprint,
        embedding: encodedEmbedding,
      });
    }
  }

  async searchSemantics(embedding: number[], limit: number, threshold: number): Promise<SemanticMatch[]> {
    return this.vectors.search(this.db, this.validator.semanticsTable(), embedding, limit, threshold);
  }

  async searchEmbeddings(embedding: number[], limit: number, threshold: number): Promise<SemanticMatch[]> {
    return this.vectors.search(this.db, this.validator.embeddingsTable(), embedding, limit, threshold);
  }

  async scoreEmbeddingsForTools(
    embedding: number[],
    toolNames: string[],
  ): Promise<Array<{ toolName: string; similarity: number }>> {
    if (toolNames.length === 0) return [];
    const nameSet = new Set(toolNames);
    const rows = await this.listEmbeddings();

    return rows
      .filter((row) => nameSet.has(row.toolName) && row.embedding != null)
      .map((row) => ({
        toolName: row.toolName,
        similarity: cosineSimilarity(embedding, normalizeStoredEmbedding(row.embedding)),
      }))
      .filter((row) => Number.isFinite(row.similarity));
  }

  async getGroupsForTools(toolNames: string[]): Promise<Set<string>> {
    const table = this.validator.embeddingsTable();
    if (toolNames.length === 0) return new Set();

    const rows = await this.db
      .select({ toolName: table.toolName, group: table.group })
      .from(table);

    const groups = new Set<string>();
    const nameSet = new Set(toolNames);
    for (const row of rows ?? []) {
      if (row.toolName && nameSet.has(row.toolName) && row.group) {
        groups.add(row.group);
      }
    }
    return groups;
  }

  async getToolsByGroup(group: string): Promise<string[]> {
    const table = this.validator.embeddingsTable();
    const rows = await this.db
      .select({ toolName: table.toolName })
      .from(table)
      .where(eq(table.group, group));
    return (rows ?? []).map((r: any) => r.toolName as string);
  }

  async getToolsByGroups(groups: string[]): Promise<Map<string, string[]>> {
    const table = this.validator.embeddingsTable();
    if (groups.length === 0) return new Map();

    const rows = await this.db
      .select({ toolName: table.toolName, group: table.group })
      .from(table);

    const result = new Map<string, string[]>();
    for (const group of groups) {
      result.set(group, []);
    }

    for (const row of rows ?? []) {
      if (row.toolName && row.group && groups.includes(row.group)) {
        result.get(row.group)!.push(row.toolName);
      }
    }

    return result;
  }

  async upsertSemantic(data: UpsertSemanticData & { skipIfHasEmbedding?: boolean }): Promise<'inserted' | 'updated' | 'skipped'> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    const rows = await this.db
      .select()
      .from(table)
      .where(
        sql`${table.toolName} = ${data.toolName} AND ${table.phrase} = ${data.phrase} AND ${table.lang} = ${data.lang}`,
      )
      .limit(1);

    const existing = rows?.[0] ?? null;

    if (existing) {
      if (data.skipIfHasEmbedding && existing.embedding != null) {
        return 'skipped';
      }
      const encodedEmbedding = data.embedding ? this.vectors.encodeEmbedding(data.embedding) : null;
      const setValues: Record<string, unknown> = {
        source: data.source ?? null,
        embedding: encodedEmbedding,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      if (data.sourceFile !== undefined) setValues.sourceFile = data.sourceFile ?? null;
      await this.db
        .update(table)
        .set(setValues)
        .where(eq(table.id, existing.id));
      return 'updated';
    }

    const encodedEmbedding = data.embedding ? this.vectors.encodeEmbedding(data.embedding) : null;
    const insertValues: Record<string, unknown> = {
      toolName: data.toolName,
      phrase: data.phrase,
      lang: data.lang,
      source: data.source ?? null,
      sourceFile: data.sourceFile ?? null,
      embedding: encodedEmbedding,
    };
    await this.db.insert(table).values(insertValues);
    return 'inserted';
  }

  async countSemantics(): Promise<number> {
    const table = this.validator.semanticsTable();
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table);
    return row?.count ?? 0;
  }

  async countEmbeddings(): Promise<number> {
    const table = this.validator.embeddingsTable();
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table);
    return row?.count ?? 0;
  }

  async listSemantics(toolName?: string): Promise<SemanticPhraseRow[]> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    if (toolName) {
      return this.db.select().from(table).where(eq(table.toolName, toolName));
    }
    return this.db.select().from(table);
  }

  async listSemanticsPaginated(opts: {
    toolName?: string;
    toolNames?: string[];
    lang?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: SemanticPhraseRow[]; total: number }> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    const conditions = [];
    if (opts.toolName) conditions.push(eq(table.toolName, opts.toolName));
    if (opts.toolNames) {
      if (opts.toolNames.length === 0) {
        return { items: [], total: 0 };
      }
      conditions.push(inArray(table.toolName, opts.toolNames));
    }
    if (opts.lang) conditions.push(eq(table.lang, opts.lang));
    if (opts.search) conditions.push(like(table.phrase, `%${opts.search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(where);
    const total = countRow?.count ?? 0;

    const items = await this.db
      .select()
      .from(table)
      .where(where)
      .orderBy(table.toolName, table.lang, table.phrase)
      .limit(opts.limit)
      .offset(opts.offset);

    return { items, total };
  }

  async getSemanticGroups(toolName?: string, toolNames?: string[]): Promise<SemanticGroupsResult> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    const conditions = [];
    if (toolName) conditions.push(eq(table.toolName, toolName));
    if (toolNames) {
      if (toolNames.length === 0) {
        return { groups: [], total: 0 };
      }
      conditions.push(inArray(table.toolName, toolNames));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        lang: table.lang,
        count: sql<number>`count(*)`,
      })
      .from(table)
      .where(where)
      .groupBy(table.lang)
      .orderBy(table.lang);

    const groups: SemanticGroup[] = rows.map((r: any) => ({
      lang: r.lang,
      total: r.count,
    }));
    const total = groups.reduce((sum, g) => sum + g.total, 0);
    return { groups, total };
  }

  async findExistingSemantics(keys: Array<{ toolName: string; phrase: string; lang: string }>): Promise<Map<string, { id: string; hasEmbedding: boolean }>> {
    if (keys.length === 0) return new Map();
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    const result = new Map<string, { id: string; hasEmbedding: boolean }>();
    const CHUNK = 200;

    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK);
      const orConditions = chunk.map((k) =>
        sql`(${table.toolName} = ${k.toolName} AND ${table.phrase} = ${k.phrase} AND ${table.lang} = ${k.lang})`
      );
      const combined = sql.join(orConditions, sql` OR `);

      const rows = await this.db
        .select({
          id: table.id,
          toolName: table.toolName,
          phrase: table.phrase,
          lang: table.lang,
          embedding: table.embedding,
        })
        .from(table)
        .where(combined);

      for (const row of rows) {
        const key = `${row.toolName}\u0000${row.phrase}\u0000${row.lang}`;
        result.set(key, { id: row.id, hasEmbedding: row.embedding != null });
      }
    }
    return result;
  }

  async findSemanticById(id: string): Promise<SemanticPhraseRow | null> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    const [row] = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
    return row ?? null;
  }

  async updateSemanticById(id: string, data: Partial<Pick<UpsertSemanticData, 'phrase' | 'lang'>> & { embedding?: number[] | null }): Promise<void> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    const patch: Record<string, unknown> = { updatedAt: sql`CURRENT_TIMESTAMP` };
    if (data.phrase !== undefined) patch.phrase = data.phrase;
    if (data.lang !== undefined) patch.lang = data.lang;
    if ('embedding' in data) {
      patch.embedding = data.embedding ? this.vectors.encodeEmbedding(data.embedding) : null;
    }
    await this.db.update(table).set(patch).where(eq(table.id, id));
  }

  async deleteSemanticById(id: string): Promise<void> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    await this.db.delete(table).where(eq(table.id, id));
  }

  async deleteSemanticsByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    await this.db.delete(table).where(inArray(table.id, ids));
    return ids.length;
  }

  async deleteAllSemantics(): Promise<number> {
    await this.ensureSemanticsSourceFileColumn();
    const total = await this.countSemantics();
    await this.db.delete(this.validator.semanticsTable());
    return total;
  }

  async pruneDuplicateSemantics(): Promise<number> {
    const rows = await this.listSemantics();
    const seen = new Set<string>();
    let deleted = 0;

    for (const row of rows) {
      const key = `${row.toolName}\u0000${row.phrase}\u0000${row.lang}`;
      if (!seen.has(key)) {
        seen.add(key);
        continue;
      }

      await this.deleteSemanticById(row.id);
      deleted++;
    }

    return deleted;
  }

  async listSemanticsWithoutEmbeddings(): Promise<SemanticPhraseRow[]> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    return this.db.select().from(table).where(isNull(table.embedding));
  }

  async updateSemanticEmbeddingById(id: string, embedding: number[]): Promise<void> {
    await this.ensureSemanticsSourceFileColumn();
    const table = this.validator.semanticsTable();
    await this.db
      .update(table)
      .set({ embedding: this.vectors.encodeEmbedding(embedding), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(table.id, id));
  }

  private async ensureSemanticsSourceFileColumn(): Promise<void> {
    if (this.semanticsSchemaChecked) return;
    if (this.semanticsSchemaCheck) return this.semanticsSchemaCheck;

    this.semanticsSchemaCheck = this.ensureSemanticsSourceFileColumnOnce()
      .then(() => {
        this.semanticsSchemaChecked = true;
      })
      .finally(() => {
        this.semanticsSchemaCheck = null;
      });

    return this.semanticsSchemaCheck;
  }

  private async ensureSemanticsSourceFileColumnOnce(): Promise<void> {
    if (typeof this.db.all === 'function') {
      const columns = await this.db.all(sql`PRAGMA table_info(chatbot_tool_semantics)`);
      const list = Array.isArray(columns) ? columns : columns?.rows ?? [];
      if (list.length === 0 || list.some((column: any) => column.name === 'source_file')) return;
      await this.db.run(sql`ALTER TABLE chatbot_tool_semantics ADD COLUMN source_file TEXT`);
      await this.db.run(sql`CREATE INDEX IF NOT EXISTS semantics_tool_lang_idx ON chatbot_tool_semantics(tool_name, lang)`);
      return;
    }

    if (typeof this.db.execute === 'function') {
      await this.db.execute(sql`
        ALTER TABLE chatbot_tool_semantics
        ADD COLUMN IF NOT EXISTS source_file text
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS semantics_tool_lang_idx
        ON chatbot_tool_semantics(tool_name, lang)
      `);
    }
  }
}

function normalizeStoredEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (value instanceof Float32Array) return Array.from(value);
  if (Buffer.isBuffer(value)) return decodeF32(value);
  if (value instanceof ArrayBuffer) return decodeF32(Buffer.from(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(Number);
      } catch {
        return [];
      }
    }
  }
  return [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }

  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}
