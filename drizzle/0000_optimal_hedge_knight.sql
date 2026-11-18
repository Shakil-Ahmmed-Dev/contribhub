CREATE TYPE "public"."actor_type" AS ENUM('user', 'github_sync', 'system');--> statement-breakpoint
CREATE TYPE "public"."contribution_event_type" AS ENUM('created', 'updated', 'status_changed', 'priority_changed', 'repository_linked', 'github_ref_linked', 'github_ref_unlinked', 'github_synced', 'pr_merged_detected', 'pr_closed_detected', 'note_added', 'checklist_item_completed', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."contribution_type" AS ENUM('existing_issue', 'feature_idea', 'bug_or_improvement', 'documentation', 'refactoring', 'performance', 'security', 'developer_experience', 'testing', 'other');--> statement-breakpoint
CREATE TYPE "public"."estimated_effort" AS ENUM('xs', 's', 'm', 'l', 'xl');--> statement-breakpoint
CREATE TYPE "public"."github_external_status" AS ENUM('open', 'closed', 'merged', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."github_ref_type" AS ENUM('issue', 'pull_request', 'discussion', 'commit');--> statement-breakpoint
CREATE TYPE "public"."note_content_type" AS ENUM('investigation', 'code_snippet', 'general');--> statement-breakpoint
CREATE TYPE "public"."personal_status" AS ENUM('inbox', 'researching', 'ready', 'in_progress', 'pr_submitted', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('documentation', 'source_file', 'discussion', 'external_url', 'other');--> statement-breakpoint
CREATE TYPE "public"."tracking_status" AS ENUM('active', 'watching', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."upstream_outcome" AS ENUM('none', 'open_pr', 'merged', 'closed_unmerged', 'accepted_externally');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repository_id" bigint,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"normalized_full_name" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"language" text,
	"default_branch" text,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"etag" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_github_repository_id_unique" UNIQUE("github_repository_id"),
	CONSTRAINT "repositories_normalized_full_name_unique" UNIQUE("normalized_full_name")
);
--> statement-breakpoint
CREATE TABLE "user_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"repository_id" uuid NOT NULL,
	"personal_notes" text DEFAULT '' NOT NULL,
	"tracking_status" "tracking_status" DEFAULT 'active' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"actor_type" "actor_type" DEFAULT 'user' NOT NULL,
	"event_type" "contribution_event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"repository_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"proposed_solution" text DEFAULT '' NOT NULL,
	"reproduction_steps" text DEFAULT '' NOT NULL,
	"contribution_type" "contribution_type" DEFAULT 'bug_or_improvement' NOT NULL,
	"personal_status" "personal_status" DEFAULT 'inbox' NOT NULL,
	"upstream_outcome" "upstream_outcome" DEFAULT 'none' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"estimated_effort" "estimated_effort",
	"source_url" text,
	"kanban_position" double precision DEFAULT 1000 NOT NULL,
	"personal_completed_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"abandoned_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"github_user_id" bigint NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"encrypted_access_token" text NOT NULL,
	"token_iv" text NOT NULL,
	"token_auth_tag" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"scopes" text DEFAULT '' NOT NULL,
	"rate_limit_remaining" integer,
	"rate_limit_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "github_accounts_github_user_id_unique" UNIQUE("github_user_id")
);
--> statement-breakpoint
CREATE TABLE "github_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reference_type" "github_ref_type" NOT NULL,
	"external_id" text,
	"number" integer,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text,
	"external_status" "github_external_status" DEFAULT 'unknown' NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"etag" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"content_type" "note_content_type" DEFAULT 'investigation' NOT NULL,
	"code_language" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"resource_type" "resource_type" DEFAULT 'external_url' NOT NULL,
	"title" text NOT NULL,
	"url_or_path" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_tags" (
	"contribution_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_tags_contribution_id_tag_id_pk" PRIMARY KEY("contribution_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_backlog_view" text DEFAULT 'kanban' NOT NULL,
	"saved_filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"table_columns" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_repositories" ADD CONSTRAINT "user_repositories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_repositories" ADD CONSTRAINT "user_repositories_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_events" ADD CONSTRAINT "contribution_events_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_events" ADD CONSTRAINT "contribution_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_accounts" ADD CONSTRAINT "github_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_references" ADD CONSTRAINT "github_references_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_references" ADD CONSTRAINT "github_references_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_checklists" ADD CONSTRAINT "contribution_checklists_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_notes" ADD CONSTRAINT "contribution_notes_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_notes" ADD CONSTRAINT "contribution_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_resources" ADD CONSTRAINT "contribution_resources_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_tags" ADD CONSTRAINT "contribution_tags_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_tags" ADD CONSTRAINT "contribution_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "repositories_owner_idx" ON "repositories" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "repositories_language_idx" ON "repositories" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "user_repositories_user_repo_uidx" ON "user_repositories" USING btree ("user_id","repository_id");--> statement-breakpoint
CREATE INDEX "user_repositories_user_status_idx" ON "user_repositories" USING btree ("user_id","tracking_status");--> statement-breakpoint
CREATE INDEX "contribution_events_contrib_created_idx" ON "contribution_events" USING btree ("contribution_id","created_at");--> statement-breakpoint
CREATE INDEX "contribution_events_user_created_idx" ON "contribution_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "contributions_user_status_pos_idx" ON "contributions" USING btree ("user_id","personal_status","kanban_position");--> statement-breakpoint
CREATE INDEX "contributions_user_repo_idx" ON "contributions" USING btree ("user_id","repository_id");--> statement-breakpoint
CREATE INDEX "contributions_user_priority_idx" ON "contributions" USING btree ("user_id","priority");--> statement-breakpoint
CREATE INDEX "contributions_user_updated_idx" ON "contributions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_refs_contrib_url_uidx" ON "github_references" USING btree ("contribution_id","normalized_url");--> statement-breakpoint
CREATE INDEX "github_refs_user_url_idx" ON "github_references" USING btree ("user_id","normalized_url");--> statement-breakpoint
CREATE INDEX "github_refs_user_type_status_idx" ON "github_references" USING btree ("user_id","reference_type","external_status");--> statement-breakpoint
CREATE INDEX "contribution_checklists_contrib_pos_idx" ON "contribution_checklists" USING btree ("contribution_id","position");--> statement-breakpoint
CREATE INDEX "contribution_notes_contrib_idx" ON "contribution_notes" USING btree ("contribution_id","created_at");--> statement-breakpoint
CREATE INDEX "contribution_notes_user_idx" ON "contribution_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contribution_resources_contrib_idx" ON "contribution_resources" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "contribution_tags_tag_idx" ON "contribution_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_slug_uidx" ON "tags" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "tags_user_idx" ON "tags" USING btree ("user_id");