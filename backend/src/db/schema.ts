import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";

export const teamRole = pgEnum("team_role", ["owner", "manager", "member"]);
export const assignmentPriority = pgEnum("assignment_priority", ["Low", "Medium", "High"]);

export type TeamRole = (typeof teamRole.enumValues)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ...timestamps,
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: teamRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] }), index("team_members_user_idx").on(t.userId)],
);

/** People work can be assigned to. Just a name per team; they don't need an account. */
export const teamPeople = pgTable(
  "team_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("team_people_team_name_idx").on(t.teamId, sql`lower(${t.name})`)],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectName: text("project_name").notNull(),
    // Legacy single-assignee columns, superseded by assignment_people; kept so old data isn't dropped.
    assigneeId: uuid("assignee_id").references(() => authUsers.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => teamPeople.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    assignDate: date("assign_date", { mode: "string" }).notNull(),
    deadline: date("deadline", { mode: "string" }).notNull(),
    priority: assignmentPriority("priority").notNull().default("Medium"),
    tasks: text("tasks").array().notNull().default(sql`'{}'::text[]`),
    notes: text("notes").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("assignments_team_deadline_idx").on(t.teamId, t.deadline),
    index("assignments_assignee_idx").on(t.assigneeId),
    index("assignments_person_idx").on(t.personId),
    check("assignments_deadline_after_assign_date", sql`${t.deadline} >= ${t.assignDate}`),
  ],
);

/** Who an assignment is assigned to; an assignment can have several people. */
export const assignmentPeople = pgTable(
  "assignment_people",
  {
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => teamPeople.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.assignmentId, t.personId] }),
    index("assignment_people_person_idx").on(t.personId),
  ],
);
