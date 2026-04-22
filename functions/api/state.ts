import { getSessionUser, jsonResponse } from "../utils/auth";

interface Env {
  DB: D1Database;
}

const MAX_STATE_BYTES = 256 * 1024; // 256 KB

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSessionUser(request, env.DB);
  if (!user) {
    return jsonResponse({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at as updatedAt FROM app_state WHERE user_id = ?",
    )
      .bind(user.userId)
      .first<{ data: string; updatedAt: number }>();
    if (!row) {
      return jsonResponse({ data: null, updatedAt: null });
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.data);
    } catch {
      parsed = null;
    }
    return jsonResponse({ data: parsed, updatedAt: row.updatedAt });
  }

  if (request.method === "PUT") {
    const text = await request.text();
    if (text.length > MAX_STATE_BYTES) {
      return jsonResponse(
        { error: "Daten zu groß." },
        { status: 413 },
      );
    }
    try {
      JSON.parse(text);
    } catch {
      return jsonResponse({ error: "Ungültiges JSON." }, { status: 400 });
    }
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO app_state (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
      .bind(user.userId, text, now)
      .run();
    return jsonResponse({ ok: true, updatedAt: now });
  }

  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
};
