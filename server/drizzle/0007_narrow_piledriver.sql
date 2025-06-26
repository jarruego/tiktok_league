CREATE TABLE "football_data_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"competition_name" varchar(100) NOT NULL,
	"competition_code" varchar(10) NOT NULL,
	"raw_data" jsonb NOT NULL,
	"season" varchar(20) NOT NULL,
	"teams_count" integer NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
