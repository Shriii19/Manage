import { and, asc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { teamPeople } from "../db/schema.js";
import { MANAGERS, requireRole } from "../lib/team-access.js";
import { currentUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const teamParams = z.object({ teamId: z.uuid() });
const personParams = teamParams.extend({ personId: z.uuid() });
const personBody = z.object({ name: z.string().trim().min(1, "Name is required").max(80) });

const personColumns = { id: teamPeople.id, name: teamPeople.name, createdAt: teamPeople.createdAt };

export const peopleRouter = Router({ mergeParams: true });

peopleRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = teamParams.parse(req.params);
  await requireRole(teamId, user.id);

  const people = await db
    .select(personColumns)
    .from(teamPeople)
    .where(eq(teamPeople.teamId, teamId))
    .orderBy(asc(sql`lower(${teamPeople.name})`));

  res.json(people);
});

peopleRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = teamParams.parse(req.params);
  await requireRole(teamId, user.id, MANAGERS);
  const { name } = personBody.parse(req.body);

  // Names are unique per team, case-insensitively (team_people_team_name_idx).
  const [created] = await db
    .insert(teamPeople)
    .values({ teamId, name })
    .onConflictDoNothing()
    .returning(personColumns);

  if (!created) {
    throw new HttpError(409, `${name} is already in this team`);
  }
  res.status(201).json(created);
});

peopleRouter.delete("/:personId", async (req, res) => {
  const user = currentUser(req);
  const { teamId, personId } = personParams.parse(req.params);
  await requireRole(teamId, user.id, MANAGERS);

  // Assignments pointing at this person become unassigned (FK is ON DELETE SET NULL).
  const deleted = await db
    .delete(teamPeople)
    .where(and(eq(teamPeople.teamId, teamId), eq(teamPeople.id, personId)))
    .returning({ id: teamPeople.id });

  if (deleted.length === 0) {
    throw new HttpError(404, "Person not found");
  }
  res.status(204).end();
});
