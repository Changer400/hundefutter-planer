import { Hono } from "hono";
import type { DB } from "../db.js";
import { getSessionUser } from "../utils/auth.js";

type Env = {
  Variables: { db: DB; cookieSecure: boolean };
};

const MAX_STATE_BYTES = 256 * 1024; // 256 KB

export function stateRoutes(): Hono<Env> {
  const app = new Hono<Env>();

  app.get("/api/state", (c) => {
    const user = getSessionUser(c.req.header("Cookie") ?? null, c.var.db);
    if (!user) return c.json({ error: "Nicht eingeloggt." }, 401);
    const row = c.var.db
      .prepare(
        "SELECT data, updated_at as updatedAt FROM app_state WHERE user_id = ?",
      )
      .get(user.userId) as { data: string; updatedAt: number } | undefined;
    if (!row) return c.json({ data: null, updatedAt: null });
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.data);
    } catch {
      parsed = null;
    }
    return c.json({ data: parsed, updatedAt: row.updatedAt });
  });

  app.put("/api/state", async (c) => {
    const user = getSessionUser(c.req.header("Cookie") ?? null, c.var.db);
    if (!user) return c.json({ error: "Nicht eingeloggt." }, 401);
    const text = await c.req.text();
    if (text.length > MAX_STATE_BYTES) {
      return c.json({ error: "Daten zu groß." }, 413);
    }
    try {
      JSON.parse(text);
    } catch {
      return c.json({ error: "Ungültiges JSON." }, 400);
    }
    const now = Date.now();
    c.var.db
      .prepare(
        `INSERT INTO app_state (user_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(user.userId, text, now);
    return c.json({ ok: true, updatedAt: now });
  });

  return app;
}
