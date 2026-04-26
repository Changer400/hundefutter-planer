import { jsonResponse, requireMethod } from "../../utils/auth";
import {
  clearSessionCookie,
  parseCookies,
  SESSION_COOKIE,
} from "../../utils/session";

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const mErr = requireMethod(request, "POST");
  if (mErr) return mErr;

  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SESSION_COOKIE];
  if (sid) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }
  return jsonResponse(
    { ok: true },
    {
      status: 200,
      headers: { "Set-Cookie": clearSessionCookie() },
    },
  );
};
