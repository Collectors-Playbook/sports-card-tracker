CREATE TABLE IF NOT EXISTS pop_report_snapshots (
  id text PRIMARY KEY NOT NULL,
  cardId text NOT NULL,
  gradingCompany text NOT NULL,
  grade text NOT NULL,
  totalGraded integer NOT NULL,
  targetGradePop integer NOT NULL,
  higherGradePop integer NOT NULL,
  percentile real NOT NULL,
  rarityTier text NOT NULL,
  gradeBreakdown text DEFAULT '[]' NOT NULL,
  fetchedAt text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pop_snapshots_cardId ON pop_report_snapshots (cardId);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pop_snapshots_fetchedAt ON pop_report_snapshots (fetchedAt);
--> statement-breakpoint
ALTER TABLE card_comp_reports ADD COLUMN popMultiplier real;
--> statement-breakpoint
ALTER TABLE card_comp_reports ADD COLUMN popAdjustedAverage real;
--> statement-breakpoint
ALTER TABLE card_comp_reports ADD COLUMN popData text;
