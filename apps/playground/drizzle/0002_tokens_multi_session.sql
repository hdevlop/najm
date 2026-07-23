DROP INDEX IF EXISTS `tokens_user_id_unique`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tokens_user_id_idx` ON `tokens` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tokens_token_family_unique` ON `tokens` (`token_family`);
