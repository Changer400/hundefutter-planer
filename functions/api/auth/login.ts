import { verifyPassword } from "../../utils/password";
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
  if (!username || !password) {
    return jsonResponse(
      { error: "Benutzername oder Passwort falsch." },
      { status: 401 },
    );
  }

  const row = await env.DB.prepare(
    "SELECT id, username, password_hash as passwordHash FROM users WHERE username_lower = ?",
  )
    .bind(username.toLowerCase())
    .first<{ id: string; username: string; passwordHash: string }>();

  if (!row) {
    // Run a dummy verify to equalize timing.
    await verifyPassword(
      password,
      "pbkdf2_sha256$200000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    );
    return jsonResponse(
      { error: "Benutzername oder Passwort falsch." },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) {
    return jsonResponse(
      { error: "Benutzername oder Passwort falsch." },
      { status: 401 },
    );
  }

  const sessionId = randomId(32);
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(sessionId, row.id, now + SESSION_TTL_MS, now)
    .run();

  return jsonResponse(
    { ok: true, user: { username: row.username } },
    {
      status: 200,
      headers: { "Set-Cookie": buildSessionCookie(sessionId) },
    },
  );
};
