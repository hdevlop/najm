const loadedClients = new WeakSet<object>();
type SqliteVecImporter = () => Promise<any>;
const defaultSqliteVecImporter: SqliteVecImporter = () => import('sqlite-vec');
let sqliteVecImporter: SqliteVecImporter = defaultSqliteVecImporter;

export function setSqliteVecImporterForTests(importer?: SqliteVecImporter): void {
  sqliteVecImporter = importer ?? defaultSqliteVecImporter;
}

export async function loadSqliteVec(client: any): Promise<void> {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'najm-rag tool routing on sqlite requires access to the raw sqlite client. ' +
        'Use drizzle-orm/bun-sqlite or drizzle-orm/better-sqlite3 so db.$client is available.',
    );
  }

  if (loadedClients.has(client)) return;

  let sqliteVec: any;
  try {
    sqliteVec = await sqliteVecImporter();
  } catch {
    throw new Error(
      'najm-rag tool routing on sqlite requires the optional peer dependency `sqlite-vec`. ' +
        'Install it with `bun add sqlite-vec` (or `npm i sqlite-vec`).',
    );
  }

  try {
    sqliteVec.load(client);
    loadedClients.add(client);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      'najm-rag tool routing on sqlite failed to load sqlite-vec into the raw sqlite client. ' +
        `Underlying error: ${message}`,
    );
  }
}
