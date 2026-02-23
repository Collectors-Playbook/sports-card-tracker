CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entityId` text,
	`details` text,
	`ipAddress` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity`,`entityId`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_userId` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_createdAt` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text DEFAULT '' NOT NULL,
	`collectionId` text,
	`collectionType` text DEFAULT 'Inventory' NOT NULL,
	`player` text NOT NULL,
	`team` text NOT NULL,
	`year` integer NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`cardNumber` text NOT NULL,
	`parallel` text,
	`condition` text NOT NULL,
	`gradingCompany` text,
	`setName` text,
	`serialNumber` text,
	`grade` text,
	`isRookie` integer DEFAULT false,
	`isAutograph` integer DEFAULT false,
	`isRelic` integer DEFAULT false,
	`isNumbered` integer DEFAULT false,
	`isGraded` integer DEFAULT false,
	`purchasePrice` real NOT NULL,
	`purchaseDate` text NOT NULL,
	`sellPrice` real,
	`sellDate` text,
	`currentValue` real NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT '',
	`color` text DEFAULT '#4F46E5',
	`isDefault` integer DEFAULT false,
	`visibility` text DEFAULT 'private',
	`tags` text DEFAULT '[]',
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`result` text,
	`error` text,
	`progress` real DEFAULT 0 NOT NULL,
	`totalItems` integer DEFAULT 0 NOT NULL,
	`completedItems` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`profilePhoto` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);