import { useEffect, useRef, useState } from "react";
import type { AppState, MealKey } from "../lib/types";
import { ageInMonths, dailyAmounts, perMeal } from "../lib/calc";
import { Button, Card, TimeInput } from "./ui";
import {
  testNotification,
  useNotificationStatus,
} from "../lib/notifications";
import {
  getPushCapability,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushCapability,
} from "../lib/push";

const MEAL_LABELS: Record<MealKey, string> = {
  morgens: "Morgens",
  mittags: "Mittags",
  nachmittags: "Nachmittags",
  abends: "Abends",
};

export function RemindersSection({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const notifStatus = useNotificationStatus();
  const firedRef = useRef<Record<string, boolean>>({});
  const months = ageInMonths(state.birthDate);
  const d = dailyAmounts(state.weightKg, months, state.customMealsPerDay);

  const [pushCap, setPushCap] = useState<PushCapability>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getPushCapability();
      if (!cancelled) setPushCap(c);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Foreground fallback: if the tab is open and permission granted but not
  // subscribed, still fire local notifications at the configured times.
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;
      const dateKey = now.toISOString().slice(0, 10);

      (Object.keys(state.reminders) as MealKey[]).forEach((meal) => {
        const time = state.reminders[meal];
        if (time === currentTime) {
          const key = `${dateKey}-${meal}`;
          if (!firedRef.current[key] && notifStatus === "granted") {
            const perMealG = perMeal(d.tfGPerDay, d.mealsPerDay);
            testNotification(
              `🐾 Fütterungs-Erinnerung: ${MEAL_LABELS[meal]}`,
              `Zeit zum Füttern! (${perMealG} g)`,
            );
            firedRef.current[key] = true;
          }
        }
      });
    };

    const i = setInterval(checkReminders, 30000);
    checkReminders();
    return () => clearInterval(i);
  }, [state.reminders, notifStatus, d.tfGPerDay, d.mealsPerDay]);

  const testOne = (meal: MealKey) => {
    const perMealG = perMeal(d.tfGPerDay, d.mealsPerDay);
    testNotification(
      `🐾 Test: ${MEAL_LABELS[meal]}`,
      `Dies ist eine Test-Erinnerung (${perMealG} g).`,
    );
  };

  const onEnablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await subscribeToPush();
    setPushBusy(false);
    if (r.ok) {
      setPushCap("subscribed");
      setPushMsg("Push aktiviert – du bekommst Erinnerungen auch bei geschlossenem Browser.");
    } else {
      setPushMsg(`Fehler: ${r.error ?? "unbekannt"}`);
    }
  };

  const onDisablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await unsubscribeFromPush();
    setPushBusy(false);
    if (r.ok) {
      const c = await getPushCapability();
      setPushCap(c);
      setPushMsg("Push deaktiviert.");
    } else {
      setPushMsg(`Fehler: ${r.error ?? "unbekannt"}`);
    }
  };

  const onSendTestPush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await sendTestPush();
    setPushBusy(false);
    if (r.ok) {
      setPushMsg("Test-Push gesendet. Sollte in Kürze erscheinen.");
    } else {
      setPushMsg(`Test fehlgeschlagen: ${r.error ?? "unbekannt"}`);
    }
  };

  return (
    <Card title="⏰ Fütterungs-Erinnerungen" tone="purple">
      <div className="mb-3 rounded border border-purple-900 bg-purple-950/40 p-3 text-sm">
        <div className="font-semibold text-purple-200 mb-2">
          📲 Push-Benachrichtigungen (auch bei geschlossener App)
        </div>
        {pushCap === "unsupported" && (
          <div className="text-amber-300">
            Dein Browser unterstützt keine Push-Benachrichtigungen.
            Auf dem iPhone funktioniert Push nur als installierte PWA
            (Safari → „Zum Home-Bildschirm").
          </div>
        )}
        {pushCap === "denied" && (
          <div className="text-amber-300">
            Benachrichtigungen blockiert – bitte in den Browser-Einstellungen
            erlauben und Seite neu laden.
          </div>
        )}
        {(pushCap === "default" || pushCap === "granted") && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              tone="purple"
              onClick={onEnablePush}
              disabled={pushBusy}
            >
              🔔 Push aktivieren
            </Button>
            <span className="text-xs text-slate-400">
              Erinnerungen kommen auch, wenn die Seite nicht offen ist.
            </span>
          </div>
        )}
        {pushCap === "subscribed" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-300 font-semibold">
              ✓ Push aktiv
            </span>
            <Button
              tone="purple"
              onClick={onSendTestPush}
              disabled={pushBusy}
              className="!px-2 !py-1 text-xs"
            >
              Test-Push senden
            </Button>
            <Button
              tone="purple"
              onClick={onDisablePush}
              disabled={pushBusy}
              className="!px-2 !py-1 text-xs"
            >
              Deaktivieren
            </Button>
          </div>
        )}
        {pushMsg && (
          <div className="mt-2 text-xs text-slate-300">{pushMsg}</div>
        )}
      </div>

      {notifStatus === "denied" && (
        <div className="mb-3 text-sm text-amber-300">
          🔕 Benachrichtigungen blockiert – bitte in Browser-Einstellungen
          erlauben.
        </div>
      )}
      {notifStatus === "default" && (
        <div className="mb-3 flex items-center gap-2 text-sm text-amber-300">
          <Button
            tone="purple"
            onClick={() => Notification.requestPermission()}
          >
            🔔 Benachrichtigungen aktivieren
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(MEAL_LABELS) as MealKey[]).map((meal) => (
          <div
            key={meal}
            className="rounded border border-purple-900 bg-purple-950/40 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-purple-200">
                {MEAL_LABELS[meal]}
              </span>
              <Button
                tone="purple"
                onClick={() => testOne(meal)}
                className="!px-2 !py-1 text-xs"
              >
                Test 🔔
              </Button>
            </div>
            <TimeInput
              value={state.reminders[meal]}
              onChange={(v) =>
                update((s) => ({
                  ...s,
                  reminders: { ...s.reminders, [meal]: v },
                }))
              }
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
