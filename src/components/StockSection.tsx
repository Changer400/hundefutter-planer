import type { AppState } from "../lib/types";
import { ageInMonths, dailyAmounts, isoToday } from "../lib/calc";
import { Button, Card, NumberInput } from "./ui";
import { useNotificationStatus } from "../lib/notifications";

export function StockSection({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const months = ageInMonths(state.birthDate);
  const d = dailyAmounts(state.weightKg, months, state.customMealsPerDay);
  const today = isoToday();
  const fedToday = state.lastFedDate === today;
  const notifStatus = useNotificationStatus();

  const feedToday = () => {
    update((s) => ({
      ...s,
      stockG: Math.max(0, s.stockG - d.tfGPerDay),
      lastFedDate: today,
    }));
  };

  const undoFeed = () => {
    update((s) => ({
      ...s,
      stockG: s.stockG + d.tfGPerDay,
      lastFedDate: null,
    }));
  };

  return (
    <Card title="📦 Trockenfutter-Vorrat" tone="amber">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label className="text-sm font-semibold text-amber-200 block mb-1">
            Aktueller Vorrat (g):
          </label>
          <NumberInput
            value={state.stockG || ""}
            onChange={(v) => update((s) => ({ ...s, stockG: Math.max(0, v) }))}
            min={0}
            placeholder="z. B. 5000"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            tone="emerald"
            onClick={feedToday}
            disabled={fedToday || d.tfGPerDay === 0}
            className="flex-1 sm:flex-none"
          >
            {fedToday
              ? `✓ Heute gefüttert (−${d.tfGPerDay} g)`
              : `☑️ Heute gefüttert (−${d.tfGPerDay} g)`}
          </Button>
          {fedToday && (
            <Button tone="slate" onClick={undoFeed}>
              ↩︎
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 text-sm text-amber-300">
        {notifStatus === "granted" && "🔔 Benachrichtigungen aktiv."}
        {notifStatus === "denied" &&
          "🔕 Benachrichtigungen blockiert. Bitte in den Browser-Einstellungen erlauben."}
        {notifStatus === "default" && (
          <button
            className="underline hover:text-amber-200"
            onClick={() => Notification.requestPermission()}
          >
            🔔 Benachrichtigungen aktivieren
          </button>
        )}
        {notifStatus === "unsupported" &&
          "Benachrichtigungen werden in diesem Browser nicht unterstützt."}
      </div>
      {state.stockG > 0 && d.tfGPerDay > 0 && (
        <div className="mt-2 text-xs text-slate-400">
          Reicht für ca.{" "}
          <span className="text-amber-300 font-semibold">
            {Math.floor(state.stockG / d.tfGPerDay)}
          </span>{" "}
          Tage.
        </div>
      )}
    </Card>
  );
}
