import { getSessionUser, jsonResponse, requireMethod } from "../../utils/auth";

interface Env {
  DB: D1Database;
}

function randomId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const user = await getSessionUser(request, env.DB);
  if (!user) return jsonResponse({ error: "Nicht eingeloggt." }, { status: 401 });

  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültiges JSON." }, { status: 400 });
  }
  const { endpoint, p256dh, auth } = body;
  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    !endpoint.startsWith("https://")
  ) {
    return jsonResponse({ error: "Ungültige Subscription." }, { status: 400 });
  }

  const now = Date.now();
  const existing = await env.DB.prepare(
    "SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
  )
    .bind(user.userId, endpoint)
    .first<{ id: string }>();
  if (existing) {
    await env.DB.prepare(
      "UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?",
    )
      .bind(p256dh, auth, existing.id)
      .run();
    return jsonResponse({ ok: true, id: existing.id });
  }

  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, user.userId, endpoint, p256dh, auth, now)
    .run();

  return jsonResponse({ ok: true, id });
};
