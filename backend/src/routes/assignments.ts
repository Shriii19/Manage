import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/client.js";
import { assignmentPeople, assignments, teamPeople } from "../db/schema.js";
import {
  assignmentListQuerySchema,
  assignmentParamsSchema,
  assignmentTeamParamsSchema,
  createAssignmentBodySchema,
  type AssignmentListQuery,
  updateAssignmentBodySchema,
} from "../lib/assignment-validation.js";
import { MANAGERS, requireRole } from "../lib/team-access.js";
import { currentUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const statusCondition: Record<NonNullable<AssignmentListQuery["status"]>, SQL> = {
  completed: isNotNull(assignments.completedAt),
  open: and(isNull(assignments.completedAt), gte(assignments.deadline, sql`current_date`))!,
  overdue: and(isNull(assignments.completedAt), lt(assignments.deadline, sql`current_date`))!,
};

type Assignee = { id: string; name: string };

/**
 * The assignment's people as a JSON array, sorted by name; [] when unassigned.
 * Columns are qualified by hand: drizzle strips table names from column refs in single-table selects,
 * which would make the outer `assignments.id` resolve to `team_people.id` inside this subquery.
 */
const assigneesJson = sql<Assignee[]>`coalesce((
  select json_agg(json_build_object('id', p.id, 'name', p.name) order by lower(p.name))
  from ${assignmentPeople} ap
  inner join ${teamPeople} p on p.id = ap.person_id
  where ap.assignment_id = ${assignments}.id
), '[]'::json)`;

function selectAssignments() {
  return db
    .select({
      id: assignments.id,
      teamId: assignments.teamId,
      projectName: assignments.projectName,
      assignees: assigneesJson,
      createdBy: assignments.createdBy,
      assignDate: assignments.assignDate,
      deadline: assignments.deadline,
      priority: assignments.priority,
      tasks: assignments.tasks,
      notes: assignments.notes,
      completedAt: assignments.completedAt,
      createdAt: assignments.createdAt,
      updatedAt: assignments.updatedAt,
    })
    .from(assignments);
}

async function findAssignment(teamId: string, assignmentId: string) {
  const [row] = await selectAssignments()
    .where(and(eq(assignments.teamId, teamId), eq(assignments.id, assignmentId)))
    .limit(1);
  if (!row) {
    throw new HttpError(404, "Assignment not found");
  }
  return row;
}

async function assertAssignable(teamId: string, personIds: string[]) {
  if (personIds.length === 0) {
    return;
  }
  const found = await db
    .select({ id: teamPeople.id })
    .from(teamPeople)
    .where(and(eq(teamPeople.teamId, teamId), inArray(teamPeople.id, personIds)));
  if (found.length !== personIds.length) {
    throw new HttpError(400, "Every assignee must be a member of this team");
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function setAssignees(tx: Tx, assignmentId: string, personIds: string[]) {
  await tx.delete(assignmentPeople).where(eq(assignmentPeople.assignmentId, assignmentId));
  if (personIds.length > 0) {
    await tx.insert(assignmentPeople).values(personIds.map((personId) => ({ assignmentId, personId })));
  }
}

export const assignmentsRouter = Router({ mergeParams: true });

assignmentsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = assignmentTeamParamsSchema.parse(req.params);
  await requireRole(teamId, user.id);
  const query = assignmentListQuerySchema.parse(req.query);

  const conditions: SQL[] = [eq(assignments.teamId, teamId)];
  if (query.status) {
    conditions.push(statusCondition[query.status]);
  }
  if (query.personId) {
    conditions.push(
      inArray(
        assignments.id,
        db
          .select({ id: assignmentPeople.assignmentId })
          .from(assignmentPeople)
          .where(eq(assignmentPeople.personId, query.personId)),
      ),
    );
  }

  const rows = await selectAssignments()
    .where(and(...conditions))
    .orderBy(asc(assignments.deadline), asc(assignments.createdAt));

  res.json(rows);
});

assignmentsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = assignmentTeamParamsSchema.parse(req.params);
  await requireRole(teamId, user.id, MANAGERS);
  const { personIds, ...fields } = createAssignmentBodySchema.parse(req.body);
  await assertAssignable(teamId, personIds);

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(assignments)
      .values({ ...fields, teamId, createdBy: user.id })
      .returning({ id: assignments.id });
    await setAssignees(tx, created.id, personIds);
    return created.id;
  });

  res.status(201).json(await findAssignment(teamId, createdId));
});

assignmentsRouter.patch("/:assignmentId", async (req, res) => {
  const user = currentUser(req);
  const { teamId, assignmentId } = assignmentParamsSchema.parse(req.params);
  // Assignees are plain names, not accounts, so only owners and managers can change assignments.
  await requireRole(teamId, user.id, MANAGERS);
  const body = updateAssignmentBodySchema.parse(req.body);
  const existing = await findAssignment(teamId, assignmentId);

  const assignDate = body.assignDate ?? existing.assignDate;
  const deadline = body.deadline ?? existing.deadline;
  if (deadline < assignDate) {
    throw new HttpError(400, "Deadline cannot be earlier than assign date");
  }
  const { completed, personIds, ...fields } = body;
  if (personIds !== undefined) {
    await assertAssignable(teamId, personIds);
  }

  const changes = {
    ...fields,
    ...(completed === undefined
      ? {}
      : { completedAt: completed ? (existing.completedAt ?? new Date()) : null }),
    // Changing only the assignees still counts as an update to the assignment.
    ...(personIds === undefined ? {} : { updatedAt: new Date() }),
  };

  await db.transaction(async (tx) => {
    if (Object.keys(changes).length > 0) {
      await tx
        .update(assignments)
        .set(changes)
        .where(and(eq(assignments.teamId, teamId), eq(assignments.id, assignmentId)));
    }
    if (personIds !== undefined) {
      await setAssignees(tx, assignmentId, personIds);
    }
  });

  res.json(await findAssignment(teamId, assignmentId));
});

assignmentsRouter.delete("/:assignmentId", async (req, res) => {
  const user = currentUser(req);
  const { teamId, assignmentId } = assignmentParamsSchema.parse(req.params);
  await requireRole(teamId, user.id, MANAGERS);

  const deleted = await db
    .delete(assignments)
    .where(and(eq(assignments.teamId, teamId), eq(assignments.id, assignmentId)))
    .returning({ id: assignments.id });

  if (deleted.length === 0) {
    throw new HttpError(404, "Assignment not found");
  }
  res.status(204).end();
});
