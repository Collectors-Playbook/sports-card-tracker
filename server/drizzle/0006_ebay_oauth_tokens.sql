CREATE TABLE IF NOT EXISTS ebay_oauth_tokens (
  id text PRIMARY KEY NOT NULL,
  userId text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  accessTokenEncrypted text NOT NULL,
  refreshTokenEncrypted text NOT NULL,
  accessTokenExpiresAt text NOT NULL,
  refreshTokenExpiresAt text NOT NULL,
  ebayUsername text,
  scopes text DEFAULT '' NOT NULL,
  isActive integer DEFAULT 1 NOT NULL,
  createdAt text NOT NULL,
  updatedAt text NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS idx_ebay_oauth_userId ON ebay_oauth_tokens (userId);
CREATE INDEX IF NOT EXISTS idx_ebay_oauth_environment ON ebay_oauth_tokens (environment);
