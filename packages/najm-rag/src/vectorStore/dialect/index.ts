import { sql } from 'drizzle-orm';
import { encodeF32 } from '../vectorBlob';
import type { SemanticMatch } from '../../toolIndex';

export interface VectorMatch {
  key: string;
  similarity: number;
}

export interface VectorStrategy {
  encodeEmbedding(values: number[]): number[] | Buffer;
  search(
    db: any,
    table: any,
    embedding: number[],
    limit: number,
    threshold: number,
  ): Promise<SemanticMatch[]>;
  searchBy(
    db: any,
    table: any,
    keyColumn: string,
    embedding: number[],
    limit: number,
    threshold: number,
  ): Promise<VectorMatch[]>;
}

export function normalizeSemanticRows(rows: any): SemanticMatch[] {
  const list = Array.isArray(rows) ? rows : rows?.rows ?? [];
  return list.map((r: any) => ({
    toolName: r.tool_name as string,
    similarity: Number(r.similarity),
  }));
}

export function normalizeVectorRows(rows: any, keyColumn: string): VectorMatch[] {
  const list = Array.isArray(rows) ? rows : rows?.rows ?? [];
  const snake = keyColumn.replace(/([A-Z])/g, '_$1').toLowerCase();
  return list.map((r: any) => ({
    key: (r[snake] ?? r[keyColumn]) as string,
    similarity: Number(r.similarity),
  }));
}

export class PgVectorStrategy implements VectorStrategy {
  encodeEmbedding(values: number[]) {
    return values;
  }

  async search(db: any, table: any, embedding: number[], limit: number, threshold: number) {
    const vectorStr = `[${embedding.join(',')}]`;
    const rows = await db.execute(sql`
      SELECT "tool_name", 1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM ${table}
      WHERE 1 - (embedding <=> ${vectorStr}::vector) >= ${threshold}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);
    return normalizeSemanticRows(rows);
  }

  async searchBy(db: any, table: any, keyColumn: string, embedding: number[], limit: number, threshold: number) {
    const vectorStr = `[${embedding.join(',')}]`;
    const col = keyColumn.replace(/([A-Z])/g, '_$1').toLowerCase();
    const rows = await db.execute(sql`
      SELECT "${sql.raw(col)}", 1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM ${table}
      WHERE 1 - (embedding <=> ${vectorStr}::vector) >= ${threshold}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);
    return normalizeVectorRows(rows, keyColumn);
  }
}

export class SqliteVecStrategy implements VectorStrategy {
  encodeEmbedding(values: number[]) {
    return encodeF32(values);
  }

  async search(db: any, table: any, embedding: number[], limit: number, threshold: number) {
    const vec = encodeF32(embedding);
    const rows = await db.all(sql`
      SELECT tool_name, 1 - vec_distance_cosine(embedding, ${vec}) AS similarity
      FROM ${table}
      WHERE embedding IS NOT NULL
        AND 1 - vec_distance_cosine(embedding, ${vec}) >= ${threshold}
      ORDER BY vec_distance_cosine(embedding, ${vec}) ASC
      LIMIT ${limit}
    `);
    return normalizeSemanticRows(rows);
  }

  async searchBy(db: any, table: any, keyColumn: string, embedding: number[], limit: number, threshold: number) {
    const vec = encodeF32(embedding);
    const col = keyColumn.replace(/([A-Z])/g, '_$1').toLowerCase();
    const rows = await db.all(sql`
      SELECT ${sql.raw(col)}, 1 - vec_distance_cosine(embedding, ${vec}) AS similarity
      FROM ${table}
      WHERE embedding IS NOT NULL
        AND 1 - vec_distance_cosine(embedding, ${vec}) >= ${threshold}
      ORDER BY vec_distance_cosine(embedding, ${vec}) ASC
      LIMIT ${limit}
    `);
    return normalizeVectorRows(rows, keyColumn);
  }
}
