CREATE TABLE "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"total_leagues" integer NOT NULL,
	"teams_per_league" integer DEFAULT 20 NOT NULL,
	"promote_slots" integer DEFAULT 0,
	"promote_playoff_slots" integer DEFAULT 0,
	"relegate_slots" integer DEFAULT 0,
	"european_slots" integer DEFAULT 0,
	CONSTRAINT "divisions_level_unique" UNIQUE("level")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"group_code" varchar(10) NOT NULL,
	"division_id" integer NOT NULL,
	"max_teams" integer DEFAULT 20 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT false,
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_league_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"league_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"tiktok_followers_at_assignment" integer DEFAULT 0,
	"assignment_reason" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD CONSTRAINT "team_league_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD CONSTRAINT "team_league_assignments_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_league_assignments" ADD CONSTRAINT "team_league_assignments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_season_unique" ON "team_league_assignments" USING btree ("team_id","season_id");