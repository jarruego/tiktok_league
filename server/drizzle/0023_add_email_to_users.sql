ALTER TABLE "users" ADD COLUMN "email" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");
