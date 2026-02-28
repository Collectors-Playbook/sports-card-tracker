CREATE TABLE `ebay_export_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`totalCards` integer NOT NULL,
	`skippedPcCards` integer NOT NULL,
	`totalListingValue` real NOT NULL,
	`compPricedCards` integer DEFAULT 0 NOT NULL,
	`options` text DEFAULT '{}' NOT NULL,
	`cardSummary` text DEFAULT '[]' NOT NULL,
	`generatedAt` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ebay_drafts_generatedAt` ON `ebay_export_drafts` (`generatedAt`);
