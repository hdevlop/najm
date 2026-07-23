CREATE TABLE `whatsapp_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`instance_id` text NOT NULL,
	`jid` text NOT NULL,
	`name` text,
	`is_group` integer NOT NULL,
	`unread_count` integer DEFAULT 0,
	`is_archived` integer DEFAULT false,
	`is_pinned` integer DEFAULT false,
	`is_muted` integer DEFAULT false,
	`labels` text,
	`last_message_at` text
);
--> statement-breakpoint
CREATE INDEX `wa_chats_instance_idx` ON `whatsapp_chats` (`instance_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`instance_id` text NOT NULL,
	`jid` text NOT NULL,
	`phone` text,
	`name` text,
	`push_name` text,
	`profile_picture_url` text,
	`is_business` integer,
	`labels` text,
	`last_message_at` text
);
--> statement-breakpoint
CREATE INDEX `wa_contacts_instance_idx` ON `whatsapp_contacts` (`instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wa_contacts_jid_idx` ON `whatsapp_contacts` (`instance_id`,`jid`);--> statement-breakpoint
CREATE TABLE `whatsapp_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`instance_id` text NOT NULL,
	`jid` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`participant_count` integer DEFAULT 0,
	`is_admin` integer DEFAULT false,
	`picture_url` text
);
--> statement-breakpoint
CREATE INDEX `wa_groups_instance_idx` ON `whatsapp_groups` (`instance_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`phone` text,
	`profile_name` text,
	`connected_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE TABLE `whatsapp_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`instance_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`predefined` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`direction` text NOT NULL,
	`jid` text NOT NULL,
	`from_me` integer NOT NULL,
	`type` text NOT NULL,
	`content` text,
	`wa_message_id` text,
	`quoted_id` text,
	`status` text,
	`metadata` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wa_messages_instance_idx` ON `whatsapp_messages` (`instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wa_messages_wa_id_idx` ON `whatsapp_messages` (`instance_id`,`wa_message_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_session_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`key_type` text NOT NULL,
	`key_id` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_session_keys_unique` ON `whatsapp_session_keys` (`instance_id`,`key_type`,`key_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`creds` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_sessions_instance_id_unique` ON `whatsapp_sessions` (`instance_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_studio_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`instance_id` text,
	`user_id` text,
	`details` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `whatsapp_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text,
	`event_type` text NOT NULL,
	`payload` text,
	`forward_status` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `whatsapp_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text,
	`updated_at` text,
	`instance_id` text,
	`url` text NOT NULL,
	`events` text,
	`headers` text,
	`enabled` integer DEFAULT true NOT NULL
);
