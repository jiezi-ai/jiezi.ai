DROP TABLE IF EXISTS applications;

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apply_code TEXT NOT NULL UNIQUE,
  github_id TEXT,
  batch INTEGER NOT NULL DEFAULT 1,
  name TEXT DEFAULT '',
  school TEXT,
  major TEXT,
  grade TEXT,
  edu_email TEXT NOT NULL,
  motivation TEXT,
  pr_number INTEGER,
  verify_token TEXT UNIQUE,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'draft',
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_resend_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  detail TEXT,
  status TEXT NOT NULL
);
