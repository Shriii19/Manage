import { and, asc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { authUsers } from "../db/auth-schema.js";
import { db } from "../db/client.js";
import { assignments, teamMembers, teams } from "../db/schema.js";
import { getRole, listTeamsForUser, MANAGERS, requireRole } from "../lib/team-access.js";
import { currentUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { assignmentsRouter } from "./assignments.js";
import { peopleRouter } from "./people.js";

const teamParams = z.object({ teamId: z.uuid() });
const memberParams = teamParams.extend({ userId: z.uuid() });

const teamBody = z.object({ name: z.string().trim().min(1).max(120) });
const assignableRole = z.enum(["manager", "member"]);
const addMemberBody = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  role: assignableRole.default("member"),
});
const updateMemberBody = z.object({ role: assignableRole });

export const teamsRouter = Router();

teamsRouter.get("/", async (req, res) => {
  res.json(await listTeamsForUser(currentUser(req).id));
});

teamsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const { name } = teamBody.parse(req.body);

  const team = await db.transaction(async (tx) => {
    const [created] = await tx.insert(teams).values({ name }).returning();
    await tx.insert(teamMembers).values({ teamId: created.id, userId: user.id, role: "owner" });
    return created;
  });

  res.status(201).json({ ...team, role: "owner" });
});

teamsRouter.patch("/:teamId", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = teamParams.parse(req.params);
  const role = await requireRole(teamId, user.id, ["owner"]);
  const { name } = teamBody.parse(req.body);

  const [team] = await db.update(teams).set({ name }).where(eq(teams.id, teamId)).returning();
  res.json({ ...team, role });
});

teamsRouter.delete("/:teamId", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = teamParams.parse(req.params);
  await requireRole(teamId, user.id, ["owner"]);

  await db.delete(teams).where(eq(teams.id, teamId));
  res.status(204).end();
});

teamsRouter.get("/:teamId/members", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = teamParams.parse(req.params);
  await requireRole(teamId, user.id);

  const members = await db
    .select({
      userId: teamMembers.userId,
      name: authUsers.name,
      email: authUsers.email,
      image: authUsers.image,
      role: teamMembers.role,
      joinedAt: teamMembers.createdAt,
    })
    .from(teamMembers)
    .innerJoin(authUsers, eq(authUsers.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(authUsers.name));

  res.json(members);
});

teamsRouter.post("/:teamId/members", async (req, res) => {
  const user = currentUser(req);
  const { teamId } = teamParams.parse(req.params);
  const actorRole = await requireRole(teamId, user.id, MANAGERS);
  const body = addMemberBody.parse(req.body);

  if (actorRole === "manager" && body.role !== "member") {
    throw new HttpError(403, "Managers can only add members");
  }

  const [target] = await db
    .select({ id: authUsers.id, name: authUsers.name, email: authUsers.email, image: authUsers.image })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${body.email}`)
    .limit(1);

  if (!target) {
    throw new HttpError(404, "No account found with that email. Ask them to sign up first.");
  }

  const [membership] = await db
    .insert(teamMembers)
    .values({ teamId, userId: target.id, role: body.role })
    .onConflictDoNothing()
    .returning();

  if (!membership) {
    throw new HttpError(409, "That user is already a member of this team");
  }

  res.status(201).json({
    userId: target.id,
    name: target.name,
    email: target.email,
    image: target.image,
    role: membership.role,
    joinedAt: membership.createdAt,
  });
});

teamsRouter.patch("/:teamId/members/:userId", async (req, res) => {
  const user = currentUser(req);
  const { teamId, userId } = memberParams.parse(req.params);
  await requireRole(teamId, user.id, ["owner"]);
  const { role } = updateMemberBody.parse(req.body);

  const targetRole = await getRole(teamId, userId);
  if (!targetRole) {
    throw new HttpError(404, "Member not found");
  }
  if (targetRole === "owner") {
    throw new HttpError(400, "The owner's role can't be changed");
  }

  await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  res.json({ userId, role });
});

teamsRouter.delete("/:teamId/members/:userId", async (req, res) => {
  const user = currentUser(req);
  const { teamId, userId } = memberParams.parse(req.params);
  const actorRole = await requireRole(teamId, user.id);

  const targetRole = await getRole(teamId, userId);
  if (!targetRole) {
    throw new HttpError(404, "Member not found");
  }
  if (targetRole === "owner") {
    throw new HttpError(400, "The owner can't be removed. Delete the team instead.");
  }

  const canRemove =
    userId === user.id ||
    actorRole === "owner" ||
    (actorRole === "manager" && targetRole === "member");
  if (!canRemove) {
    throw new HttpError(403, "You don't have permission to remove this member");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    await tx
      .update(assignments)
      .set({ assigneeId: null })
      .where(and(eq(assignments.teamId, teamId), eq(assignments.assigneeId, userId)));
  });

  res.status(204).end();
});

teamsRouter.use("/:teamId/assignments", assignmentsRouter);
teamsRouter.use("/:teamId/people", peopleRouter);
