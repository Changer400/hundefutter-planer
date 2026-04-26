import { useState } from "react";
import type {
  AppState,
  FoodCategory,
  FoodStockEntry,
  FoodUnit,
} from "../lib/types";
import { ageInMonths, dailyAmounts, isoToday, todayKey } from "../lib/calc";
import { Button, Card, NumberInput, Select, TextInput } from "./ui";
import { useNotificationStatus } from "../lib/notifications";

const UNIT_OPTIONS: { value: FoodUnit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "Stück", label: "Stück" },
  { value: "Beutel", label: "Beutel" },
  { value: "Dose", label: "Dose" },
];

const CATEGORY_OPTIONS: { value: FoodCategory; label: string }[] = [
  { value: "TF", label: "Trockenfutter" },
  { value: "BARF", label: "BARF" },
  { value: "NF", label: "Nassfutter" },
  { value: "andere", label: "Andere (Snacks, …)" },
];

const DEFAULT_LOW_DAYS = 7;

function genId() {
  return `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function unitInGrams(unit: FoodUnit): number | null {
  if (unit === "g") return 1;
  if (unit === "kg") return 1000;
  return null;
}

/** Effektiver Tagesverbrauch in derselben Einheit wie der Eintrag. */
function effectiveDailyInUnit(
  entry: FoodStockEntry,
  dailyTFg: number,
  dailyBARFg: number,
): number | null {
  if (entry.dailyConsumption && entry.dailyConsumption > 0)
    return entry.dailyConsumption;
  const factor = unitInGrams(entry.unit);
  if (factor === null) return null;
  if (entry.category === "TF") return dailyTFg / factor;
  if (entry.category === "BARF") return dailyBARFg / factor;
  return null;
}

function daysLeft(
  entry: FoodStockEntry,
  dailyTFg: number,
  dailyBARFg: number,
): number | null {
  const d = effectiveDailyInUnit(entry, dailyTFg, dailyBARFg);
  if (d === null || d <= 0) return null;
  return Math.floor(entry.amount / d);
}

function formatAmount(n: number, unit: FoodUnit): string {
  if (unit === "g" || unit === "kg") {
    return `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${unit}`;
  }
  return `${n} ${unit}`;
}

export function FoodStocks({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const months = ageInMonths(state.birthDate);
  const d = dailyAmounts(state.weightKg, months);
  const today = isoToday();
  const fedToday = state.lastFedDate === today;
  const todaysCategory: FoodCategory = state.weekPlan[todayKey()];
  const dailyForToday =
    todaysCategory === "BARF" ? d.barfGPerDay : d.tfGPerDay;
  const notifStatus = useNotificationStatus();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<FoodStockEntry>({
    id: "",
    name: "",
    amount: 0,
    unit: "g",
    category: "TF",
  });
  const stocks = state.foodStocks ?? [];

  /** Summiert Vorrat in Gramm über alle Einträge einer Kategorie (nur g/kg-Einträge). */
  const sumGrams = (cat: FoodCategory): number =>
    stocks
      .filter((e) => e.category === cat)
      .reduce((acc, e) => {
        const factor = unitInGrams(e.unit);
        if (factor === null) return acc;
        return acc + e.amount * factor;
      }, 0);

  const tfTotalG = sumGrams("TF");
  const barfTotalG = sumGrams("BARF");
  const tfTotalDays =
    d.tfGPerDay > 0 ? Math.floor(tfTotalG / d.tfGPerDay) : null;
  const barfTotalDays =
    d.barfGPerDay > 0 ? Math.floor(barfTotalG / d.barfGPerDay) : null;
  const hasTF = stocks.some((e) => e.category === "TF");
  const hasBARF = stocks.some((e) => e.category === "BARF");

  const updateEntry = (id: string, patch: Partial<FoodStockEntry>) => {
    update((s) => ({
      ...s,
      foodStocks: (s.foodStocks ?? []).map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }));
  };

  const removeEntry = (id: string) => {
    update((s) => ({
      ...s,
      foodStocks: (s.foodStocks ?? []).filter((e) => e.id !== id),
    }));
  };

  const addEntry = () => {
    if (!draft.name.trim() || draft.amount <= 0) return;
    const newEntry: FoodStockEntry = { ...draft, id: genId() };
    update((s) => ({ ...s, foodStocks: [...(s.foodStocks ?? []), newEntry] }));
    setAdding(false);
    setDraft({ id: "", name: "", amount: 0, unit: "g", category: "TF" });
  };

  /** „Heute gefüttert": zieht Tagesmenge vom passenden Eintrag (Kategorie, g/kg) ab. */
  const feedToday = () => {
    update((s) => {
      const list = s.foodStocks ?? [];
      const idx = list.findIndex(
        (e) =>
          e.category === todaysCategory &&
          (e.unit === "g" || e.unit === "kg") &&
          e.amount > 0,
      );
      let nextStocks = list;
      if (idx >= 0) {
        const e = list[idx];
        const factor = unitInGrams(e.unit) ?? 1;
        const deduct = dailyForToday / factor;
        nextStocks = list.map((x, i) =>
          i === idx ? { ...x, amount: Math.max(0, x.amount - deduct) } : x,
        );
      }
      return {
        ...s,
        foodStocks: nextStocks,
        // legacy stockG mitziehen, falls Migration noch nicht gelaufen ist
        stockG:
          todaysCategory === "TF"
            ? Math.max(0, s.stockG - dailyForToday)
            : s.stockG,
        lastFedDate: today,
      };
    });
  };

  const undoFeed = () => {
    update((s) => {
      const list = s.foodStocks ?? [];
      const idx = list.findIndex(
        (e) =>
          e.category === todaysCategory && (e.unit === "g" || e.unit === "kg"),
      );
      let nextStocks = list;
      if (idx >= 0) {
        const e = list[idx];
        const factor = unitInGrams(e.unit) ?? 1;
        const refund = dailyForToday / factor;
        nextStocks = list.map((x, i) =>
          i === idx ? { ...x, amount: x.amount + refund } : x,
        );
      }
      return {
        ...s,
        foodStocks: nextStocks,
        stockG:
          todaysCategory === "TF" ? s.stockG + dailyForToday : s.stockG,
        lastFedDate: null,
      };
    });
  };

  return (
    <Card title="📦 Futter-Vorrat" tone="amber">
      {stocks.length === 0 && (
        <div className="text-sm text-slate-400 mb-3">
          Noch kein Futter eingetragen. Füge deinen ersten Vorrat hinzu.
        </div>
      )}

      <div className="space-y-2">
        {stocks.map((entry) => {
          const left = daysLeft(entry, d.tfGPerDay, d.barfGPerDay);
          const lowThreshold = entry.lowDays ?? DEFAULT_LOW_DAYS;
          const empty = entry.amount <= 0;
          const low = left !== null && left <= lowThreshold && !empty;
          return (
            <div
              key={entry.id}
              className={`rounded-lg border p-3 ${
                empty
                  ? "border-rose-700 bg-rose-900/30"
                  : low
                    ? "border-amber-700 bg-amber-900/20"
                    : "border-slate-700 bg-slate-900/40"
              }`}
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs text-slate-400 block mb-1">
                    Name
                  </label>
                  <TextInput
                    value={entry.name}
                    onChange={(v) => updateEntry(entry.id, { name: v })}
                    placeholder="z. B. Royal Canin Welpe"
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs text-slate-400 block mb-1">
                    Vorrat
                  </label>
                  <NumberInput
                    value={entry.amount || ""}
                    onChange={(v) =>
                      updateEntry(entry.id, { amount: Math.max(0, v) })
                    }
                    min={0}
                    placeholder="0"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-slate-400 block mb-1">
                    Einheit
                  </label>
                  <Select<FoodUnit>
                    value={entry.unit}
                    onChange={(v) => updateEntry(entry.id, { unit: v })}
                    options={UNIT_OPTIONS}
                  />
                </div>
                <div className="w-40">
                  <label className="text-xs text-slate-400 block mb-1">
                    Kategorie
                  </label>
                  <Select<FoodCategory>
                    value={entry.category}
                    onChange={(v) => updateEntry(entry.id, { category: v })}
                    options={CATEGORY_OPTIONS}
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs text-slate-400 block mb-1">
                    Pro Tag
                  </label>
                  <NumberInput
                    value={entry.dailyConsumption ?? ""}
                    onChange={(v) =>
                      updateEntry(entry.id, {
                        dailyConsumption: v > 0 ? v : undefined,
                      })
                    }
                    min={0}
                    placeholder="auto"
                  />
                </div>
                <Button
                  tone="slate"
                  onClick={() => removeEntry(entry.id)}
                  className="!px-3"
                >
                  🗑
                </Button>
              </div>
              <div className="mt-2 text-xs flex flex-wrap items-center gap-2">
                <span className="text-slate-400">
                  Vorrat:{" "}
                  <span className="text-slate-200 font-semibold">
                    {formatAmount(entry.amount, entry.unit)}
                  </span>
                </span>
                {left !== null ? (
                  <span
                    className={
                      empty
                        ? "text-rose-300"
                        : low
                          ? "text-amber-300"
                          : "text-emerald-300"
                    }
                  >
                    {empty
                      ? "🚨 leer — bitte nachkaufen!"
                      : low
                        ? `⚠️ reicht nur noch ${left} Tag${left === 1 ? "" : "e"}`
                        : `✅ reicht ca. ${left} Tage`}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">
                    Tagesverbrauch eintragen für Reichweite
                  </span>
                )}
                {entry.dailyConsumption ? (
                  <span className="text-slate-500">
                    · {entry.dailyConsumption} {entry.unit}/Tag
                  </span>
                ) : entry.category !== "andere" &&
                  unitInGrams(entry.unit) !== null ? (
                  <span className="text-slate-500">
                    · auto{" "}
                    {entry.category === "BARF" ? d.barfGPerDay : d.tfGPerDay}
                    g/Tag
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-900/20 p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-slate-400 block mb-1">Name</label>
              <TextInput
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
                placeholder="z. B. Rinderpansen"
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-slate-400 block mb-1">Menge</label>
              <NumberInput
                value={draft.amount || ""}
                onChange={(v) =>
                  setDraft({ ...draft, amount: Math.max(0, v) })
                }
                min={0}
                placeholder="0"
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-slate-400 block mb-1">
                Einheit
              </label>
              <Select<FoodUnit>
                value={draft.unit}
                onChange={(v) => setDraft({ ...draft, unit: v })}
                options={UNIT_OPTIONS}
              />
            </div>
            <div className="w-40">
              <label className="text-xs text-slate-400 block mb-1">
                Kategorie
              </label>
              <Select<FoodCategory>
                value={draft.category}
                onChange={(v) => setDraft({ ...draft, category: v })}
                options={CATEGORY_OPTIONS}
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-slate-400 block mb-1">
                Pro Tag
              </label>
              <NumberInput
                value={draft.dailyConsumption ?? ""}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    dailyConsumption: v > 0 ? v : undefined,
                  })
                }
                min={0}
                placeholder="auto"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button tone="slate" onClick={() => setAdding(false)}>
              Abbrechen
            </Button>
            <Button
              tone="emerald"
              onClick={addEntry}
              disabled={!draft.name.trim() || draft.amount <= 0}
            >
              Hinzufügen
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button tone="emerald" onClick={() => setAdding(true)}>
            ➕ Futter hinzufügen
          </Button>
        </div>
      )}

      {(hasTF || hasBARF) && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm space-y-1">
          <div className="font-semibold text-slate-200 mb-1">
            Gesamter Vorrat
          </div>
          {hasTF && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-300">
                Trockenfutter: {formatAmount(tfTotalG, "g")}
              </span>
              <span
                className={
                  tfTotalDays !== null && tfTotalDays <= 7
                    ? "text-amber-300 font-semibold"
                    : "text-emerald-300 font-semibold"
                }
              >
                {tfTotalDays !== null
                  ? `reicht ca. ${tfTotalDays} Tage`
                  : "—"}
              </span>
            </div>
          )}
          {hasBARF && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-300">
                BARF: {formatAmount(barfTotalG, "g")}
              </span>
              <span
                className={
                  barfTotalDays !== null && barfTotalDays <= 7
                    ? "text-amber-300 font-semibold"
                    : "text-emerald-300 font-semibold"
                }
              >
                {barfTotalDays !== null
                  ? `reicht ca. ${barfTotalDays} Tage`
                  : "—"}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <Button
          tone="emerald"
          onClick={feedToday}
          disabled={fedToday || dailyForToday === 0}
          className="flex-1"
        >
          {fedToday ? "✓ Heute gefüttert" : "☑️ Heute gefüttert"}
        </Button>
        {fedToday && (
          <Button tone="slate" onClick={undoFeed}>
            ↩︎ rückgängig
          </Button>
        )}
      </div>

      <div className="mt-3 text-xs text-amber-300">
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
    </Card>
  );
}
