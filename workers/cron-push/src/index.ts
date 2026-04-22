import { sendWebPush, type PushSubscription } from "./webpush";

type MealKey = "morgens" | "mittags" | "nachmittags" | "abends";
const MEAL_LABELS: Record<MealKey, string> = {
  morgens: "Morgens",
  mittags: "Mittags",
  nachmittags: "Nachmittags",
  abends: "Abends",
};
const MEAL_KEYS: MealKey[] = ["morgens", "mittags", "nachmittags", "abends"];

type AppStateShape = {
  reminders?: Partial<Record<MealKey, string>>;
  weightKg?: number;
  birthDate?: string;
};

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  state: string | null;
};

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  TIMEZONE?: string;
}

function currentClockParts(tz: string): { hhmm: string; dateKey: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hh = get("hour");
  const mm = get("minute");
  const yyyy = get("year");
  const MM = get("month");
  const dd = get("day");
  return { hhmm: `${hh}:${mm}`, dateKey: `${yyyy}-${MM}-${dd}` };
}

async function runTick(env: Env): Promise<{
  checked: number;
  sent: number;
  errors: number;
}> {
  const tz = env.TIMEZONE || "Europe/Berlin";
  const { hhmm, dateKey } = currentClockParts(tz);

  const rows = await env.DB.prepare(
    `SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth, a.data AS state
     FROM push_subscriptions ps
     LEFT JOIN app_state a ON a.user_id = ps.user_id`,
  )
    .all<SubRow>();

  const subs = rows.results ?? [];
  let sent = 0;
  let errors = 0;

  for (const row of subs) {
    if (!row.state) continue;
    let state: AppStateShape;
    try {
      state = JSON.parse(row.state) as AppStateShape;
    } catch {
      continue;
    }
    const reminders = state.reminders ?? {};

    for (const meal of MEAL_KEYS) {
      if (reminders[meal] !== hhmm) continue;

      // Dedup: have we already fired this (subscription, date, meal)?
      const already = await env.DB.prepare(
        "SELECT 1 FROM push_fired WHERE subscription_id = ? AND date = ? AND meal = ?",
      )
        .bind(row.id, dateKey, meal)
        .first();
      if (already) continue;

      const payload = JSON.stringify({
        title: `🐾 Fütterungs-Erinnerung: ${MEAL_LABELS[meal]}`,
        body: "Zeit zum Füttern!",
        icon: "/icon-192.png",
        tag: `feed-${meal}`,
        url: "/",
      });

      const sub: PushSubscription = {
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      };
      const r = await sendWebPush(sub, payload, {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      });

      if (r.ok) {
        sent++;
        await env.DB.prepare(
          `INSERT OR IGNORE INTO push_fired (subscription_id, date, meal, fired_at)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(row.id, dateKey, meal, Date.now())
          .run();
        await env.DB.prepare(
          "UPDATE push_subscriptions SET last_sent_at = ? WHERE id = ?",
        )
          .bind(Date.now(), row.id)
          .run();
      } else {
        errors++;
        if (r.gone) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
            .bind(row.id)
            .run();
        }
      }
    }
  }

  return { checked: subs.length, sent, errors };
}

export default {
  // HTTP handler: allows manual trigger for testing via /run
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/run" && request.method === "POST") {
      const secret = url.searchParams.get("secret");
      if (!secret || secret !== env.VAPID_PRIVATE_KEY.slice(0, 12)) {
        return new Response("forbidden", { status: 403 });
      }
      const r = await runTick(env);
      return new Response(JSON.stringify(r), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("hundefutter-cron-push: ok", { status: 200 });
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runTick(env).then((r) => {
        console.log(
          `cron-push tick: checked=${r.checked} sent=${r.sent} errors=${r.errors}`,
        );
      }),
    );
  },
};
