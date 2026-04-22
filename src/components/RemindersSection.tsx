import { useEffect, useRef } from "react";
import type { AppState, MealKey } from "../lib/types";
import { ageInMonths, dailyAmounts, perMeal } from "../lib/calc";
import { Button, Card, TimeInput } from "./ui";
import {
  testNotification,
  useNotificationStatus,
} from "../lib/notifications";

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
  const d = dailyAmounts(state.weightKg, months);

  // Check reminders every 30 seconds
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

  return (
    <Card title="⏰ Fütterungs-Erinnerungen" tone="purple">
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
