import "./lib/dns-ipv4-fallback.js";
import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { meRouter } from "./routes/me.js";
import { teamsRouter } from "./routes/teams.js";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "backend", date: new Date().toISOString() });
});

app.use("/api", requireAuth);
app.use("/api/me", meRouter);
app.use("/api/teams", teamsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Backend running on http://localhost:${env.PORT}`);
});
