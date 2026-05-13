CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id TEXT NOT NULL UNIQUE,
  batch INTEGER NOT NULL,
  school TEXT,
  major TEXT,
  grade TEXT,
  edu_email TEXT,
  motivation TEXT,
  pr_number INTEGER,
  verify_token TEXT UNIQUE,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  detail TEXT,
  status TEXT NOT NULL
);
