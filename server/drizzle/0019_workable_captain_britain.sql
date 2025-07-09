ALTER TABLE "matches" ADD COLUMN "is_playoff" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "playoff_round" varchar(50);--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD COLUMN "promoted_next_season" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD COLUMN "relegated_next_season" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD COLUMN "playoff_next_season" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD COLUMN "qualified_for_tournament" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;