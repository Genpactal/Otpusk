CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  team TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'hr')),
  start_date TEXT NOT NULL,
  manager_id TEXT REFERENCES employees(id),
  color TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn', 'superseded', 'expired')),
  segments JSONB NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  replaces_id TEXT REFERENCES leave_requests(id),
  created_at TEXT NOT NULL,
  reviewed_by TEXT REFERENCES employees(id)
);
CREATE TABLE IF NOT EXISTS request_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES leave_requests(id),
  actor_id TEXT REFERENCES employees(id),
  action TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_by_employee ON leave_requests(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_replacement ON leave_requests(replaces_id) WHERE status = 'pending' AND replaces_id IS NOT NULL;

-- Additive migration: preserve existing demo requests and audit history.
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS charged_segments JSONB;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS change_segment INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS unique_request_retry ON leave_requests(employee_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES employees(id),
  request_id TEXT NOT NULL REFERENCES leave_requests(id),
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS notifications_by_recipient ON notifications(recipient_id, created_at);
CREATE TABLE IF NOT EXISTS workspace_revision (id INTEGER PRIMARY KEY CHECK (id=1), revision BIGINT NOT NULL DEFAULT 0);
INSERT INTO workspace_revision (id, revision) VALUES (1,0) ON CONFLICT (id) DO NOTHING;
