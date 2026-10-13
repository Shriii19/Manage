import { Router } from "express";
import { listTeamsForUser } from "../lib/team-access.js";
import { currentUser } from "../middleware/auth.js";

export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  res.json({ user, teams: await listTeamsForUser(user.id) });
});
