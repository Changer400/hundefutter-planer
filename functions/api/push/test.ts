import { getSessionUser, jsonResponse, requireMethod } from "../../utils/auth";
import { sendWebPush } from "../../utils/webpush";

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;
  const user = await getSessionUser(request, env.DB);
  if (!user) return jsonResponse({ error: "Nicht eingeloggt." }, { status: 401 });

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return jsonResponse(
      { error: "Push ist nicht konfiguriert." },
      { status: 503 },
    );
  }

  const subs = await env.DB.prepare(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
  )
    .bind(user.userId)
    .all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

  const rows = subs.results ?? [];
  if (rows.length === 0) {
    return jsonResponse(
      { error: "Keine aktive Push-Subscription. Bitte erst aktivieren." },
      { status: 404 },
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
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT || "mailto:admin@hundefutter-planer.pages.dev",
      },
    );
    results.push({ id: row.id, ok: r.ok, status: r.status, gone: r.gone });
    if (r.gone) {
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
        .bind(row.id)
        .run();
    }
  }

  return jsonResponse({ ok: results.some((r) => r.ok), results });
};
