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
