CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'ollama' NOT NULL,
	`api_key_encrypted` text,
	`base_url` text,
	`model` text DEFAULT 'llama3.1' NOT NULL,
	`system_prompt` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_items_user_product_unique` ON `cart_items` (`user_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_key` text NOT NULL,
	`user_id` text,
	`channel` text DEFAULT 'web' NOT NULL,
	`messages` text NOT NULL,
	`expires_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_sessions_session_key_unique` ON `chat_sessions` (`session_key`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` real NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` real NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`name` text NOT NULL,
	`description` text,
	`resource` text NOT NULL,
	`action` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_name_unique` ON `permissions` (`name`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`category` text NOT NULL,
	`image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permission_unique` ON `role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`token_family` text,
	`previous_hash` text,
	`previous_valid_until` text,
	`previous_used_at` text,
	`type` text DEFAULT 'refresh',
	`status` text DEFAULT 'active',
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_user_id_unique` ON `tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `tokens_expires_at_idx` ON `tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`phone` text,
	`phone_verified` integer DEFAULT false,
	`password` text NOT NULL,
	`image` text DEFAULT 'noavatar.png',
	`status` text DEFAULT 'pending',
	`role_id` text,
	`last_login` text,
	`failed_login_attempts` integer DEFAULT 0,
	`lockout_until` text,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX `users_role_id_idx` ON `users` (`role_id`);