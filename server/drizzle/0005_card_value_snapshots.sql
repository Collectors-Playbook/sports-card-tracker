CREATE TABLE IF NOT EXISTS card_value_snapshots (
  id text PRIMARY KEY NOT NULL,
  cardId text NOT NULL,
  value real NOT NULL,
  source text NOT NULL,
  snapshotAt text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_value_snapshots_cardId ON card_value_snapshots (cardId);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_value_snapshots_snapshotAt ON card_value_snapshots (snapshotAt);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_value_snapshots_cardId_snapshotAt ON card_value_snapshots (cardId, snapshotAt);
