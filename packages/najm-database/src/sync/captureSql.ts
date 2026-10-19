import { SyncError } from './contracts';

export interface CaptureTable {
  table: string;
  entity: string;
  /** Only a simple immutable text primary key is supported by this first adapter. */
  keyColumn: string;
  yearColumn?: string;
  /** Explicit public projection property -> source column. Never copies a raw row. */
  projection: Readonly<Record<string, string>>;
}
const identifier = (value: string) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new SyncError('CAPTURE_CONFIG_INVALID');
  return value;
};
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/** Review and apply as a host-owned migration, after composing the sync schema. */
export function createCaptureSql(options: { installationId: string; tables: readonly CaptureTable[] }): string {
  if (!options.installationId || options.installationId.length > 200 || !options.tables.length
    || new Set(options.tables.map(table => table.table)).size !== options.tables.length
    || new Set(options.tables.map(table => table.entity)).size !== options.tables.length) throw new SyncError('CAPTURE_CONFIG_INVALID');
  const statements = options.tables.map(table => {
    identifier(table.table); identifier(table.entity); identifier(table.keyColumn);
    if (table.yearColumn) identifier(table.yearColumn);
    if (!Object.keys(table.projection).length || Object.values(table.projection).some(column => !/^[a-z][a-z0-9_]{0,62}$/.test(column))) throw new SyncError('CAPTURE_CONFIG_INVALID');
    return `CREATE TRIGGER najm_sync_order BEFORE INSERT OR UPDATE OR DELETE ON public.${table.table}
FOR EACH STATEMENT EXECUTE FUNCTION public.najm_sync_statement(${literal(options.installationId)});
CREATE TRIGGER najm_sync_emit AFTER INSERT OR UPDATE OR DELETE ON public.${table.table}
FOR EACH ROW EXECUTE FUNCTION public.najm_sync_emit(${literal(options.installationId)}, ${literal(table.entity)}, ${literal(table.keyColumn)}, ${literal(table.yearColumn ?? '')}, ${literal(JSON.stringify(table.projection))});
CREATE TRIGGER najm_sync_no_truncate BEFORE TRUNCATE ON public.${table.table}
FOR EACH STATEMENT EXECUTE FUNCTION public.najm_sync_reject_truncate();`;
  });
  return `
CREATE FUNCTION public.najm_sync_order(installation text) RETURNS bigint LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE p bigint; previous_installation text;
BEGIN
  p := nullif(current_setting('najm_sync.position', true), '')::bigint;
  previous_installation := nullif(current_setting('najm_sync.installation_id', true), '');
  IF p IS NOT NULL THEN
    IF previous_installation IS DISTINCT FROM installation THEN RAISE EXCEPTION 'sync installation mismatch'; END IF;
    RETURN p;
  END IF;
  INSERT INTO public.sync_counters (installation_id, position)
    SELECT id, 0 FROM public.sync_installations WHERE id = installation ON CONFLICT DO NOTHING;
  UPDATE public.sync_counters SET position = position + 1 WHERE installation_id = installation RETURNING position INTO p;
  IF p IS NULL THEN RAISE EXCEPTION 'sync installation missing'; END IF;
  PERFORM set_config('najm_sync.installation_id', installation, true);
  PERFORM set_config('najm_sync.position', p::text, true);
  RETURN p;
END $$;

CREATE FUNCTION public.najm_sync_statement() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN PERFORM public.najm_sync_order(TG_ARGV[0]); RETURN NULL; END $$;

CREATE FUNCTION public.najm_sync_emit() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; old_body jsonb; key text; r bigint; p bigint; next_scope text; old_scope text; projection jsonb; pair record;
BEGIN
  p := nullif(current_setting('najm_sync.position', true), '')::bigint;
  IF p IS NULL OR current_setting('najm_sync.installation_id', true) IS DISTINCT FROM TG_ARGV[0] THEN RAISE EXCEPTION 'sync ordering lock missing'; END IF;
  body := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  old_body := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  key := body ->> TG_ARGV[2];
  IF key IS NULL OR key = '' THEN RAISE EXCEPTION 'sync key missing'; END IF;
  IF TG_OP = 'UPDATE' AND (old_body ->> TG_ARGV[2]) IS DISTINCT FROM key THEN RAISE EXCEPTION 'sync record identity is immutable'; END IF;
  next_scope := CASE WHEN TG_ARGV[3] = '' THEN 'shared' ELSE 'year-id:' || (body ->> TG_ARGV[3]) END;
  old_scope := CASE WHEN TG_ARGV[3] = '' THEN 'shared' ELSE 'year-id:' || (old_body ->> TG_ARGV[3]) END;
  IF next_scope IS NULL THEN RAISE EXCEPTION 'sync year is unresolved'; END IF;
  INSERT INTO public.sync_record_versions (installation_id, entity, record_id, revision) VALUES (TG_ARGV[0], TG_ARGV[1], key, 1)
    ON CONFLICT (installation_id, entity, record_id) DO UPDATE SET revision = public.sync_record_versions.revision + 1 RETURNING revision INTO r;
  IF TG_OP = 'UPDATE' AND old_scope IS DISTINCT FROM next_scope THEN
    IF old_scope IS NULL THEN RAISE EXCEPTION 'sync old year is unresolved'; END IF;
    INSERT INTO public.sync_changes (installation_id, position, entity, record_id, scope, revision, deleted, value, origin_operation_id)
      VALUES (TG_ARGV[0], p, TG_ARGV[1], key, old_scope, r, true, NULL, nullif(current_setting('najm_sync.operation_id', true), ''));
  END IF;
  projection := '{}'::jsonb;
  IF TG_OP <> 'DELETE' THEN
    FOR pair IN SELECT * FROM jsonb_each_text(TG_ARGV[4]::jsonb) LOOP
      projection := projection || jsonb_build_object(pair.key, body -> pair.value);
    END LOOP;
  END IF;
  INSERT INTO public.sync_changes (installation_id, position, entity, record_id, scope, revision, deleted, value, origin_operation_id)
    VALUES (TG_ARGV[0], p, TG_ARGV[1], key, next_scope, r, TG_OP = 'DELETE', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE projection END,
      nullif(current_setting('najm_sync.operation_id', true), ''));
  RETURN NULL;
END $$;

CREATE FUNCTION public.najm_sync_reject_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'sync capture: TRUNCATE requires reviewed maintenance and an epoch reset'; END $$;

${statements.join('\n')}
`;
}
