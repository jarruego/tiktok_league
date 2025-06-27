ALTER TABLE "players" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "football_data_id" integer;