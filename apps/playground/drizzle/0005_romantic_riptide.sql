CREATE TABLE `credential_setup_requirements` (
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`temporary_credential_kind` text,
	`required` integer DEFAULT true NOT NULL,
	`completed_at` text,
	`created_at` text,
	`updated_at` text,
	PRIMARY KEY(`user_id`, `purpose`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `credential_setup_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credential_setup_sessions_token_hash_unique` ON `credential_setup_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `credential_setup_sessions_user_purpose_idx` ON `credential_setup_sessions` (`user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `credential_setup_sessions_expires_at_idx` ON `credential_setup_sessions` (`expires_at`);