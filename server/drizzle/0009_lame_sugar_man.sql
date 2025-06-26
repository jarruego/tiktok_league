ALTER TABLE "teams" ADD COLUMN "area_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "area_name" varchar(100);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "area_code" varchar(10);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "area_flag" text;