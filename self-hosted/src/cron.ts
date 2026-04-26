// In-process minute-tick that mirrors the Cloudflare Worker cron.
// Dedup key is (subscription_id, date, meal, time) — a change of reminder time
// counts as a fresh event and fires on all subscribed devices.

import type { DB } from "./db.js";
import { sendWebPush } from "./utils/webpush.js";

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
};

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  state: string | null;
};

export type CronConfig = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  timezone: string;
};

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
  return {
    hhmm: `${get("hour")}:${get("minute")}`,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export async function runTick(
  db: DB,
  cfg: CronConfig,
): Promise<{ checked: number; sent: number; errors: number }> {
  const { hhmm, dateKey } = currentClockParts(cfg.timezone);

  const subs = db
    .prepare(
      `SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth, a.data AS state
       FROM push_subscriptions ps
       LEFT JOIN app_state a ON a.user_id = ps.user_id`,
    )
    .all() as SubRow[];

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

      const already = db
        .prepare(
          "SELECT 1 FROM push_fired WHERE subscription_id = ? AND date = ? AND meal = ? AND time = ?",
        )
        .get(row.id, dateKey, meal, hhmm);
      if (already) continue;

      const payload = JSON.stringify({
        title: `🐾 Fütterungs-Erinnerung: ${MEAL_LABELS[meal]}`,
        body: "Zeit zum Füttern!",
        icon: "/icon-192.png",
        tag: `feed-${meal}`,
        url: "/",
      });

      const r = await sendWebPush(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        payload,
        {
          publicKey: cfg.vapidPublicKey,
          privateKey: cfg.vapidPrivateKey,
          subject: cfg.vapidSubject,
        },
      );

      if (r.ok) {
        sent++;
        db.prepare(
          `INSERT OR IGNORE INTO push_fired (subscription_id, date, meal, time, fired_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(row.id, dateKey, meal, hhmm, Date.now());
        db.prepare(
          "UPDATE push_subscriptions SET last_sent_at = ? WHERE id = ?",
        ).run(Date.now(), row.id);
      } else {
        errors++;
        if (r.gone) {
          db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(row.id);
        }
      }
    }
  }

  return { checked: subs.length, sent, errors };
}

export function startCron(db: DB, cfg: CronConfig): () => void {
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const msToNextMinute =
      60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    setTimeout(async () => {
      if (stopped) return;
      try {
        const r = await runTick(db, cfg);
        if (r.sent > 0 || r.errors > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[cron] tick checked=${r.checked} sent=${r.sent} errors=${r.errors}`,
          );
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[cron] tick failed:", e);
      }
      scheduleNext();
    }, Math.max(msToNextMinute, 1000));
  };

  scheduleNext();
  return () => {
    stopped = true;
  };
}
