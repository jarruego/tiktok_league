CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"tiktok_id" varchar(100) NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"description" text
);
