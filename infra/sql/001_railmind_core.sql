-- RailMind-owned persistence. Source systems (Maximo, finance, contracts) are never written.
-- Applied automatically by ensureSchema() or manually with psql.

CREATE TABLE IF NOT EXISTS railmind_audit_events (
  sequence      BIGINT PRIMARY KEY,
  hash          TEXT NOT NULL UNIQUE,
  previous_hash TEXT NOT NULL,
  action        TEXT NOT NULL,
  actor_id      TEXT NOT NULL,
  actor_role    TEXT,
  subject_type  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  at            TIMESTAMPTZ NOT NULL,
  from_state    TEXT,
  to_state      TEXT,
  reason        TEXT,
  evidence      JSONB NOT NULL DEFAULT '[]'::jsonb,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_audit_events_subject_idx ON railmind_audit_events (subject_type, subject_id, sequence);

-- Audit rows are immutable at database level.
CREATE OR REPLACE FUNCTION railmind_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'railmind_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS railmind_audit_no_update ON railmind_audit_events;
CREATE TRIGGER railmind_audit_no_update
  BEFORE UPDATE OR DELETE ON railmind_audit_events
  FOR EACH ROW EXECUTE FUNCTION railmind_audit_immutable();

CREATE TABLE IF NOT EXISTS railmind_memory_records (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  task_id    TEXT,
  subject    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  evidence   JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags       TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS railmind_memory_records_task_idx ON railmind_memory_records (task_id);
CREATE INDEX IF NOT EXISTS railmind_memory_records_kind_idx ON railmind_memory_records (kind);

CREATE TABLE IF NOT EXISTS railmind_reports (
  report_id  TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  package    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
