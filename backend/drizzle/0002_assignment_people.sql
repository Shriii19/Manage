CREATE TABLE "assignment_people" (
	"assignment_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "assignment_people_assignment_id_person_id_pk" PRIMARY KEY("assignment_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "assignment_people" ADD CONSTRAINT "assignment_people_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_people" ADD CONSTRAINT "assignment_people_person_id_team_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."team_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_people_person_idx" ON "assignment_people" USING btree ("person_id");--> statement-breakpoint
-- Data migration: each existing single assignee becomes the assignment's first assignee.
INSERT INTO "assignment_people" ("assignment_id", "person_id")
SELECT "id", "person_id" FROM "assignments" WHERE "person_id" IS NOT NULL
ON CONFLICT DO NOTHING;