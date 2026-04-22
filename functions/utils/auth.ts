import { parseCookies, SESSION_COOKIE } from "./session";

export type SessionUser = {
  userId: string;
  username: string;
};

export async function getSessionUser(
  request: Request,
  db: D1Database,
): Promise<SessionUser | null> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SESSION_COOKIE];
  if (!sid) return null;
  const row = await db
    .prepare(
      `SELECT s.user_id as userId, s.expires_at as expiresAt, u.username as username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .bind(sid)
    .first<{ userId: string; expiresAt: number; username: string }>();
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }
  return { userId: row.userId, username: row.username };
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function requireMethod(request: Request, method: string): Response | null {
  if (request.method !== method) {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }
  return null;
}
