CREATE TABLE `storage_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`namespace` text NOT NULL,
	`path` text,
	`meta` text,
	`ts` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chatbot_document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`page` integer,
	`text` text NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `chatbot_document_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`embedding` blob,
	`model` text DEFAULT '' NOT NULL,
	`dimensions` integer DEFAULT 768 NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chatbot_document_embeddings_chunk_id_unique` ON `chatbot_document_embeddings` (`chunk_id`);--> statement-breakpoint
CREATE TABLE `chatbot_document_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text DEFAULT 'rag' NOT NULL,
	`source_type` text NOT NULL,
	`original_path` text NOT NULL,
	`ext` text DEFAULT '' NOT NULL,
	`mime` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`ingested_at` text,
	`metadata` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `chatbot_routing_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`enable_knowledge` integer DEFAULT true NOT NULL,
	`max_tools` integer,
	`top_semantic_hits` integer,
	`similarity_threshold` text,
	`fallback_on_router_error` text,
	`fallback_on_no_match` text,
	`allowed_langs` text,
	`dependencies` text,
	`dangerous_intent_keywords` text,
	`tools_override` text,
	`context_override` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `chatbot_routing_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`query` text NOT NULL,
	`lang` text DEFAULT 'und' NOT NULL,
	`expected_tools` text NOT NULL,
	`last_status` text DEFAULT 'pending' NOT NULL,
	`last_confidence` integer,
	`last_actual_tools` text,
	`last_missing_tools` text,
	`last_scores` text,
	`last_run_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `chatbot_studio_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`user_id` text,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `chatbot_tool_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_name` text NOT NULL,
	`description` text NOT NULL,
	`group` text,
	`local_name` text,
	`arg_names` text,
	`annotations` text,
	`fingerprint` text NOT NULL,
	`embedding` blob,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chatbot_tool_embeddings_tool_name_unique` ON `chatbot_tool_embeddings` (`tool_name`);--> statement-breakpoint
CREATE TABLE `chatbot_tool_semantics` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_name` text NOT NULL,
	`phrase` text NOT NULL,
	`lang` text DEFAULT 'und' NOT NULL,
	`source` text,
	`source_file` text,
	`embedding` blob,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `semantics_tool_phrase_lang_idx` ON `chatbot_tool_semantics` (`tool_name`,`phrase`,`lang`);--> statement-breakpoint
CREATE INDEX `semantics_tool_lang_idx` ON `chatbot_tool_semantics` (`tool_name`,`lang`);--> statement-breakpoint
CREATE TABLE `chatbot_unmatched_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`normalized` text NOT NULL,
	`score` text NOT NULL,
	`threshold` text NOT NULL,
	`source` text DEFAULT 'router' NOT NULL,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chatbot_unmatched_queries_normalized_unique` ON `chatbot_unmatched_queries` (`normalized`);--> statement-breakpoint
CREATE TABLE `storage_buckets` (
	`name` text PRIMARY KEY NOT NULL,
	`label` text,
	`max_file_size` integer,
	`allowed_mime_types` text,
	`protected` integer DEFAULT false,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `storage_file_tags` (
	`file_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `storage_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `storage_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_file_tags_pk` ON `storage_file_tags` (`file_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `storage_files` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`file_path` text NOT NULL,
	`data` blob NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`category` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_ns_path_idx` ON `storage_files` (`namespace`,`file_path`);--> statement-breakpoint
CREATE TABLE `storage_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_tags_ns_name_idx` ON `storage_tags` (`namespace`,`name`);