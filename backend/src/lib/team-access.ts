import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { teamMembers, teams, type TeamRole } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";

export const MANAGERS: TeamRole[] = ["owner", "manager"];

export function listTeamsForUser(userId: string) {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      role: teamMembers.role,
      createdAt: teams.createdAt,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teams.name));
}

export async function getRole(teamId: string, userId: string): Promise<TeamRole | null> {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

/**
 * Non-members get 404 rather than 403 so team IDs can't be probed.
 */
export async function requireRole(
  teamId: string,
  userId: string,
  allowed?: TeamRole[],
): Promise<TeamRole> {
  const role = await getRole(teamId, userId);
  if (!role) {
    throw new HttpError(404, "Team not found");
  }
  if (allowed && !allowed.includes(role)) {
    throw new HttpError(403, `This action requires role: ${allowed.join(" or ")}`);
  }
  return role;
}
