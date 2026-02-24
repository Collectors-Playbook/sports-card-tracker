CREATE TABLE `card_comp_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`cardId` text NOT NULL,
	`condition` text,
	`aggregateAverage` real,
	`aggregateLow` real,
	`aggregateHigh` real,
	`generatedAt` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`cardId`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comp_reports_cardId` ON `card_comp_reports` (`cardId`);
--> statement-breakpoint
CREATE INDEX `idx_comp_reports_generatedAt` ON `card_comp_reports` (`generatedAt`);
--> statement-breakpoint
CREATE TABLE `card_comp_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`reportId` text NOT NULL,
	`source` text NOT NULL,
	`marketValue` real,
	`averagePrice` real,
	`low` real,
	`high` real,
	`sales` text DEFAULT '[]' NOT NULL,
	`error` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`reportId`) REFERENCES `card_comp_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comp_sources_reportId` ON `card_comp_sources` (`reportId`);
