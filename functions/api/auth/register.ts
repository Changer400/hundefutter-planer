import { hashPassword } from "../../utils/password";
import { jsonResponse, requireMethod } from "../../utils/auth";
import {
  buildSessionCookie,
  randomId,
  SESSION_TTL_MS,
} from "../../utils/session";

interface Env {
  DB: D1Database;
}

type Body = {
  username?: unknown;
  password?: unknown;
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const mErr = requireMethod(request, "POST");
  if (mErr) return mErr;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (username.length < 2) {
    return jsonResponse(
      { error: "Benutzername zu kurz (min. 2 Zeichen)." },
      { status: 400 },
    );
  }
  if (username.length > 40) {
    return jsonResponse(
      { error: "Benutzername zu lang (max. 40 Zeichen)." },
      { status: 400 },
    );
  }
  if (!/^[\w.\-äöüÄÖÜß ]+$/.test(username)) {
    return jsonResponse(
      { error: "Ungültige Zeichen im Benutzernamen." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return jsonResponse(
      { error: "Passwort zu kurz (min. 8 Zeichen)." },
      { status: 400 },
    );
  }
  if (password.length > 256) {
    return jsonResponse(
      { error: "Passwort zu lang." },
      { status: 400 },
    );
  }

  const usernameLower = username.toLowerCase();
  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE username_lower = ?",
  )
    .bind(usernameLower)
    .first();
  if (existing) {
    return jsonResponse(
      { error: "Benutzername existiert bereits." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = randomId(16);
  const now = Date.now();

  await env.DB.prepare(
    "INSERT INTO users (id, username, username_lower, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(userId, username, usernameLower, passwordHash, now)
    .run();

  const sessionId = randomId(32);
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(sessionId, userId, now + SESSION_TTL_MS, now)
    .run();

  return jsonResponse(
    { ok: true, user: { username } },
    {
      status: 200,
      headers: { "Set-Cookie": buildSessionCookie(sessionId) },
    },
  );
};
