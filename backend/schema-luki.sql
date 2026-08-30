CREATE TABLE IF NOT EXISTS luki_rate_limits (
  client_hash TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (client_hash, bucket)
);

CREATE INDEX IF NOT EXISTS idx_luki_rate_limits_updated
ON luki_rate_limits(updated_at);
