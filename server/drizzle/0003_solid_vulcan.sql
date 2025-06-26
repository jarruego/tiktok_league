ALTER TABLE "teams" ADD COLUMN "display_name" varchar(100);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "following" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "likes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "profile_url" varchar(500);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "avatar_url" text;