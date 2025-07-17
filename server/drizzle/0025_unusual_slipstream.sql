CREATE TABLE "lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"lineup" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;