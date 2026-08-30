CREATE TABLE IF NOT EXISTS account_deletions (
  uid TEXT PRIMARY KEY,
  email TEXT,
  username TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  delete_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_due
ON account_deletions(status, delete_at);
