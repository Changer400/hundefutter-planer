import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { DB } from "../db.js";
import { getSessionUser } from "../utils/auth.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { randomId } from "../utils/random.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  buildSessionCookie,
  clearSessionCookie,
  parseCookies,
} from "../utils/session.js";

type Env = {
  Variables: { db: DB; cookieSecure: boolean };
};

export function authRoutes(): Hono<Env> {
  const app = new Hono<Env>();

  app.post("/api/auth/register", async (c) => {
    const db = c.var.db;
    let body: { username?: unknown; password?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Ungültige Anfrage." }, 400);
    }
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (username.length < 2) {
      return c.json({ error: "Benutzername zu kurz (min. 2 Zeichen)." }, 400);
    }
    if (username.length > 40) {
      return c.json({ error: "Benutzername zu lang (max. 40 Zeichen)." }, 400);
    }
    if (!/^[\w.\-äöüÄÖÜß ]+$/.test(username)) {
      return c.json({ error: "Ungültige Zeichen im Benutzernamen." }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Passwort zu kurz (min. 8 Zeichen)." }, 400);
    }
    if (password.length > 256) {
      return c.json({ error: "Passwort zu lang." }, 400);
    }

    const usernameLower = username.toLowerCase();
    const existing = db
      .prepare("SELECT id FROM users WHERE username_lower = ?")
      .get(usernameLower);
    if (existing) {
      return c.json({ error: "Benutzername existiert bereits." }, 409);
    }

    const passwordHash = await hashPassword(password);
    const userId = randomId(16);
    const now = Date.now();

    db.prepare(
      "INSERT INTO users (id, username, username_lower, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, username, usernameLower, passwordHash, now);

    const sessionId = randomId(32);
    db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).run(sessionId, userId, now + SESSION_TTL_MS, now);

    c.header(
      "Set-Cookie",
      buildSessionCookie(sessionId, SESSION_TTL_MS, {
        secure: c.var.cookieSecure,
      }),
    );
    return c.json({ ok: true, user: { username } });
  });

  app.post("/api/auth/login", async (c) => {
    const db = c.var.db;
    let body: { username?: unknown; password?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Ungültige Anfrage." }, 400);
    }
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return c.json({ error: "Benutzername oder Passwort falsch." }, 401);
    }

    const row = db
      .prepare(
        "SELECT id, username, password_hash as passwordHash FROM users WHERE username_lower = ?",
      )
      .get(username.toLowerCase()) as
      | { id: string; username: string; passwordHash: string }
      | undefined;

    if (!row) {
      // Constant-time dummy verify to equalise response time.
      await verifyPassword(
        password,
        "pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      );
      return c.json({ error: "Benutzername oder Passwort falsch." }, 401);
    }

    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) {
      return c.json({ error: "Benutzername oder Passwort falsch." }, 401);
    }

    const sessionId = randomId(32);
    const now = Date.now();
    db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).run(sessionId, row.id, now + SESSION_TTL_MS, now);

    c.header(
      "Set-Cookie",
      buildSessionCookie(sessionId, SESSION_TTL_MS, {
        secure: c.var.cookieSecure,
      }),
    );
    return c.json({ ok: true, user: { username: row.username } });
  });

  app.post("/api/auth/logout", (c) => {
    const db = c.var.db;
    const cookies = parseCookies(c.req.header("Cookie") ?? null);
    const sid = cookies[SESSION_COOKIE];
    if (sid) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sid);
    }
    c.header(
      "Set-Cookie",
      clearSessionCookie({ secure: c.var.cookieSecure }),
    );
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", (c) => {
    const user = getSessionUser(c.req.header("Cookie") ?? null, c.var.db);
    if (!user) return c.json({ user: null });
    return c.json({ user: { username: user.username } });
  });

  // Suppress unused import warning (setCookie retained for possible future use).
  void setCookie;

  return app;
}
