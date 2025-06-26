CREATE TABLE "coaches" (
	"id" serial PRIMARY KEY NOT NULL,
	"football_data_id" integer,
	"name" varchar(100) NOT NULL,
	"nationality" varchar(50),
	"date_of_birth" varchar(20),
	"contract" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "coaches_football_data_id_unique" UNIQUE("football_data_id")
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "football_data_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "short_name" varchar(50);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "tla" varchar(5);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "crest" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "venue" varchar(200);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "founded" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "club_colors" varchar(100);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "website" varchar(500);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "coach_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_football_data_id_unique" UNIQUE("football_data_id");