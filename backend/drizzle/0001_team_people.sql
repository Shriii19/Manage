CREATE TABLE "team_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "team_people" ADD CONSTRAINT "team_people_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_people_team_name_idx" ON "team_people" USING btree ("team_id",lower("name"));--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_person_id_team_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."team_people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_person_idx" ON "assignments" USING btree ("person_id");--> statement-breakpoint
-- Data migration: existing assignees (signed-up users) become named people in their team.
INSERT INTO "team_people" ("team_id", "name")
SELECT DISTINCT a."team_id", COALESCE(NULLIF(TRIM(u."name"), ''), u."email")
FROM "assignments" a
JOIN "neon_auth"."user" u ON u."id" = a."assignee_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "assignments" a
SET "person_id" = p."id"
FROM "neon_auth"."user" u, "team_people" p
WHERE u."id" = a."assignee_id"
  AND p."team_id" = a."team_id"
  AND lower(p."name") = lower(COALESCE(NULLIF(TRIM(u."name"), ''), u."email"))
  AND a."person_id" IS NULL;