// Exercise the built public artifact through the same source-schema composition
// Drizzle Kit consumers use. Its CLI discovers .ts schema files, not .mjs.
export { syncInstallations, syncCounters, syncOperations, syncRecordVersions, syncChanges, syncSnapshots, syncSnapshotPages } from '../../dist/sync/pg.mjs';
