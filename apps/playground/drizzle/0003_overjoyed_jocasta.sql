PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`token_family` text NOT NULL,
	`previous_hash` text,
	`previous_valid_until` text,
	`previous_used_at` text,
	`type` text DEFAULT 'refresh',
	`status` text DEFAULT 'active',
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tokens`("id", "created_at", "updated_at", "user_id", "token", "token_family", "previous_hash", "previous_valid_until", "previous_used_at", "type", "status", "expires_at") SELECT "id", "created_at", "updated_at", "user_id", "token", "token_family", "previous_hash", "previous_valid_until", "previous_used_at", "type", "status", "expires_at" FROM `tokens`;--> statement-breakpoint
DROP TABLE `tokens`;--> statement-breakpoint
ALTER TABLE `__new_tokens` RENAME TO `tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_token_family_unique` ON `tokens` (`token_family`);--> statement-breakpoint
CREATE INDEX `tokens_user_id_idx` ON `tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `tokens_expires_at_idx` ON `tokens` (`expires_at`);--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `use_memory` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `max_stored_messages` integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `max_prompt_messages` integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `title` text;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `message_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `last_message_at` text;--> statement-breakpoint
ALTER TABLE `whatsapp_instances` ADD `auto_connect` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_instances` ADD `last_error` text;--> statement-breakpoint
ALTER TABLE `whatsapp_webhooks` ADD `signing_secret` text;