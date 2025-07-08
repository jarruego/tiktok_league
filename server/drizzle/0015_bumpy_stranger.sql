ALTER TABLE "teams" ADD COLUMN "failed_scraping_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "last_failed_at" timestamp with time zone;