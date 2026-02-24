CREATE TABLE `comp_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`result` text NOT NULL,
	`createdAt` text NOT NULL,
	`expiresAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comp_cache_expiresAt` ON `comp_cache` (`expiresAt`);
