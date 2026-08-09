CREATE TABLE `najm_theme_appearance` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`design_config` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_by_actor_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "najm_theme_appearance_revision_positive" CHECK("najm_theme_appearance"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `najm_theme_branding` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`slot_config` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_by_actor_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "najm_theme_branding_revision_positive" CHECK("najm_theme_branding"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `najm_theme_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`design_config` text NOT NULL,
	`is_built_in` integer DEFAULT false NOT NULL,
	`created_by_actor_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `najm_theme_presets_scope_slug_idx` ON `najm_theme_presets` (`scope_id`,`slug`);--> statement-breakpoint
CREATE INDEX `najm_theme_presets_scope_created_idx` ON `najm_theme_presets` (`scope_id`,`created_at`);