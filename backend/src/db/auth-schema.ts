import { pgSchema, text, uuid } from "drizzle-orm/pg-core";

// Owned by Neon Auth. Read-only from this app and deliberately not exported
// from schema.ts so drizzle-kit never generates migrations for it.
const neonAuth = pgSchema("neon_auth");

export const authUsers = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  image: text("image"),
});
