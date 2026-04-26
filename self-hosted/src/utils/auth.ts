import type { DB } from "../db.js";
import { parseCookies, SESSION_COOKIE } from "./session.js";

export type SessionUser = {
  userId: string;
  username: string;
};

export function getSessionUser(
  cookieHeader: string | null,
  db: DB,
): SessionUser | null {
  const cookies = parseCookies(cookieHeader);
  const sid = cookies[SESSION_COOKIE];
  if (!sid) return null;
  const row = db
    .prepare(
      `SELECT s.user_id as userId, s.expires_at as expiresAt, u.username as username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(sid) as
    | { userId: string; expiresAt: number; username: string }
    | undefined;
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sid);
    return null;
  }
  return { userId: row.userId, username: row.username };
}
