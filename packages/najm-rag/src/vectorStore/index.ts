export { SqliteVecBootService } from './SqliteVecBootService';
export { encodeF32, decodeF32 } from './vectorBlob';
export { loadSqliteVec } from './sqliteVecLoader';
export { PgVectorStrategy, SqliteVecStrategy, normalizeSemanticRows, normalizeVectorRows } from './dialect';
export type { VectorStrategy, VectorMatch } from './dialect';
