import { getSessionUser, jsonResponse, requireMethod } from "../../utils/auth";

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const user = await getSessionUser(request, env.DB);
  if (!user) return jsonResponse({ error: "Nicht eingeloggt." }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültiges JSON." }, { status: 400 });
  }
  const { endpoint } = body;
  if (typeof endpoint !== "string") {
    return jsonResponse({ error: "Endpoint fehlt." }, { status: 400 });
  }

  const res = await env.DB.prepare(
    "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
  )
    .bind(user.userId, endpoint)
    .run();

  return jsonResponse({ ok: true, deleted: res.meta?.changes ?? 0 });
};
