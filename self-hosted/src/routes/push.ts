import { Hono } from "hono";
import type { DB } from "../db.js";
import { getSessionUser } from "../utils/auth.js";
import { randomId } from "../utils/random.js";
import { sendWebPush } from "../utils/webpush.js";

export type PushConfig = {
  publicKey?: string;
  privateKey?: string;
  subject: string;
};

type Env = {
  Variables: { db: DB; cookieSecure: boolean };
};

export function pushRoutes(config: PushConfig): Hono<Env> {
  const app = new Hono<Env>();

  app.get("/api/push/vapid-public", (c) => {
    if (!config.publicKey) {
      return c.json({ error: "VAPID public key not configured." }, 503);
    }
    return c.json({ publicKey: config.publicKey });
  });

  app.post("/api/push/subscribe", async (c) => {
    const user = getSessionUser(c.req.header("Cookie") ?? null, c.var.db);
    if (!user) return c.json({ error: "Nicht eingeloggt." }, 401);
    let body: { endpoint?: string; p256dh?: string; auth?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Ungültiges JSON." }, 400);
    }
    const { endpoint, p256dh, auth } = body;
    if (
      typeof endpoint !== "string" ||
      typeof p256dh !== "string" ||
      typeof auth !== "string" ||
      !endpoint.startsWith("https://")
    ) {
      return c.json({ error: "Ungültige Subscription." }, 400);
    }
    const now = Date.now();
    const existing = c.var.db
      .prepare(
        "SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
      )
      .get(user.userId, endpoint) as { id: string } | undefined;
    if (existing) {
      c.var.db
        .prepare(
          "UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?",
        )
        .run(p256dh, auth, existing.id);
      return c.json({ ok: true, id: existing.id });
    }
    const id = randomId(16);
    c.var.db
      .prepare(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, user.userId, endpoint, p256dh, auth, now);
    return c.json({ ok: true, id });
  });

  app.post("/api/push/unsubscribe", async (c) => {
    const user = getSessionUser(c.req.header("Cookie") ?? null, c.var.db);
    if (!user) return c.json({ error: "Nicht eingeloggt." }, 401);
    let body: { endpoint?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Ungültiges JSON." }, 400);
    }
    const { endpoint } = body;
    if (typeof endpoint !== "string") {
      return c.json({ error: "Endpoint fehlt." }, 400);
    }
    const res = c.var.db
      .prepare(
        "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
      )
      .run(user.userId, endpoint);
    return c.json({ ok: true, deleted: res.changes });
  });

  app.post("/api/push/test", async (c) => {
    const user = getSessionUser(c.req.header("Cookie") ?? null, c.var.db);
    if (!user) return c.json({ error: "Nicht eingeloggt." }, 401);
    if (!config.publicKey || !config.privateKey) {
      return c.json({ error: "Push ist nicht konfiguriert." }, 503);
    }
    const rows = c.var.db
      .prepare(
        "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
      )
      .all(user.userId) as Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
    if (rows.length === 0) {
      return c.json(
        { error: "Keine aktive Push-Subscription. Bitte erst aktivieren." },
        404,
      );
    }
    const payload = JSON.stringify({
      title: "🐾 Test-Benachrichtigung",
      body: "Push funktioniert – du bekommst jetzt auch Erinnerungen, wenn die App geschlossen ist.",
      icon: "/icon-192.png",
      tag: "test",
    });
    const results: Array<{
      id: string;
      ok: boolean;
      status: number;
      gone?: boolean;
    }> = [];
    for (const row of rows) {
      const r = await sendWebPush(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        payload,
        {
          publicKey: config.publicKey,
          privateKey: config.privateKey,
          subject: config.subject,
        },
      );
      results.push({ id: row.id, ok: r.ok, status: r.status, gone: r.gone });
      if (r.gone) {
        c.var.db
          .prepare("DELETE FROM push_subscriptions WHERE id = ?")
          .run(row.id);
      }
    }
    return c.json({ ok: results.some((r) => r.ok), results });
  });

  return app;
}
