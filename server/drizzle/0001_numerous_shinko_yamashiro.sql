CREATE TABLE `grading_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`cardId` text NOT NULL,
	`gradingCompany` text NOT NULL,
	`submissionNumber` text NOT NULL,
	`status` text DEFAULT 'Submitted' NOT NULL,
	`tier` text DEFAULT 'Regular' NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`declaredValue` real DEFAULT 0 NOT NULL,
	`submittedAt` text NOT NULL,
	`receivedAt` text,
	`gradingAt` text,
	`shippedAt` text,
	`completedAt` text,
	`estimatedReturnDate` text,
	`grade` text,
	`notes` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cardId`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_grading_userId` ON `grading_submissions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_grading_cardId` ON `grading_submissions` (`cardId`);--> statement-breakpoint
CREATE INDEX `idx_grading_status` ON `grading_submissions` (`status`);