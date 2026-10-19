CREATE TABLE proof_marker (run_id text PRIMARY KEY);
CREATE TABLE sync_installations (id text PRIMARY KEY, epoch text NOT NULL);
CREATE TABLE sync_counters (installation_id text PRIMARY KEY REFERENCES sync_installations(id), position bigint NOT NULL DEFAULT 0);
CREATE TABLE sync_operations (installation_id text NOT NULL REFERENCES sync_installations(id), account_id text NOT NULL, operation_id text NOT NULL, device_id text NOT NULL,
  installation_epoch text NOT NULL, scope text NOT NULL, payload_hash text NOT NULL, outcome jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(installation_id,account_id,operation_id));
CREATE TABLE sync_record_versions (installation_id text NOT NULL, entity text NOT NULL, record_id text NOT NULL, revision bigint NOT NULL,
  PRIMARY KEY(installation_id,entity,record_id));
CREATE TABLE sync_changes (installation_id text NOT NULL, position bigint NOT NULL, ordinal bigint GENERATED ALWAYS AS IDENTITY,
  entity text NOT NULL, record_id text NOT NULL, scope text NOT NULL, revision bigint NOT NULL, deleted boolean NOT NULL, value jsonb, origin_operation_id text,
  PRIMARY KEY(installation_id,position,ordinal));
CREATE TABLE sync_snapshots (id text PRIMARY KEY, installation_id text NOT NULL, installation_epoch text NOT NULL, account_id text NOT NULL,
  scope text NOT NULL, authorization_generation text NOT NULL, protocol_version integer NOT NULL, replica_schema_version integer NOT NULL,
  watermark bigint NOT NULL, expires_at timestamptz NOT NULL, manifest jsonb NOT NULL);
CREATE TABLE sync_snapshot_pages (snapshot_id text NOT NULL REFERENCES sync_snapshots(id) ON DELETE CASCADE, page integer NOT NULL,
  checksum text NOT NULL, records jsonb NOT NULL, PRIMARY KEY(snapshot_id,page));
CREATE TABLE attendance (id text PRIMARY KEY, status text NOT NULL, academic_year_id text NOT NULL, secret text);
CREATE TABLE attendance_history (id text PRIMARY KEY, attendance_id text NOT NULL, old_status text, new_status text NOT NULL);
INSERT INTO sync_installations VALUES ('installation-1','epoch-1');
