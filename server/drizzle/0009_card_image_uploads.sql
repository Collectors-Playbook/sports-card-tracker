CREATE TABLE `card_image_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`cardId` text NOT NULL,
	`filename` text NOT NULL,
	`remoteUrl` text NOT NULL,
	`fileHash` text NOT NULL,
	`uploadedAt` text NOT NULL,
	FOREIGN KEY (`cardId`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_image_uploads_cardId` ON `card_image_uploads` (`cardId`);
--> statement-breakpoint
CREATE INDEX `idx_image_uploads_filename` ON `card_image_uploads` (`filename`);
