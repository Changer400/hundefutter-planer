import { useEffect, useRef, useState } from "react";
import type {
  AppState,
  DayKey,
  FoodCategory,
  FoodStockEntry,
  FoodUnit,
} from "../lib/types";
import { DAYS } from "../lib/types";
import { ageInMonths, dailyAmounts, isoToday, todayKey } from "../lib/calc";
import { Button, Card, Checkbox, NumberInput, Select, TextInput } from "./ui";
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

  // Feed-Dialog
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedEntryId, setFeedEntryId] = useState<string>("");
  const [feedAmount, setFeedAmount] = useState<number>(0);

  /** Vorgeschlagene Tagesmenge für einen Eintrag in dessen Einheit. */
  const suggestedAmount = (entry: FoodStockEntry): number => {
    if (entry.dailyConsumption && entry.dailyConsumption > 0)
      return entry.dailyConsumption;
    const factor = unitInGrams(entry.unit);
    if (factor === null) return 0;
    if (entry.category === "TF") return Math.round(d.tfGPerDay / factor);
    if (entry.category === "BARF") return Math.round(d.barfGPerDay / factor);
    return 0;
  };

  const openFeedDialog = () => {
    if (stocks.length === 0) return;
    // Voreinstellung: erster Eintrag passend zur Wochenplan-Kategorie, sonst erster überhaupt
    const preferred =
      stocks.find((e) => e.category === todaysCategory && e.amount > 0) ??
      stocks.find((e) => e.amount > 0) ??
      stocks[0];
    setFeedEntryId(preferred.id);
    setFeedAmount(suggestedAmount(preferred));
    setFeedOpen(true);
  };

  const confirmFeed = () => {
    const entry = stocks.find((e) => e.id === feedEntryId);
    if (!entry || feedAmount <= 0) return;
    update((s) => ({
      ...s,
      foodStocks: (s.foodStocks ?? []).map((e) =>
        e.id === entry.id
          ? { ...e, amount: Math.max(0, e.amount - feedAmount) }
          : e,
      ),
      lastFedDate: today,
      lastFedEntryId: entry.id,
      lastFedAmount: feedAmount,
    }));
    setFeedOpen(false);
  };

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

  const undoFeed = () => {
    update((s) => {
      const fedId = s.lastFedEntryId;
      const fedAmt = s.lastFedAmount ?? 0;
      let nextStocks = s.foodStocks ?? [];
      if (fedId && fedAmt > 0) {
        nextStocks = nextStocks.map((e) =>
          e.id === fedId ? { ...e, amount: e.amount + fedAmt } : e,
        );
      }
      return {
        ...s,
        foodStocks: nextStocks,
        lastFedDate: null,
        lastFedEntryId: null,
        lastFedAmount: null,
      };
    });
  };

  // Auto-Feed: effektiver Plan für heute
  const todayDay = todayKey();
  const effectivePlan = (() => {
    const ov = state.feedOverride;
    if (ov && ov.date === today && ov.entryId && ov.amount > 0) return ov;
    const w = state.feedSchedule?.[todayDay];
    if (w && w.entryId && w.amount > 0)
      return { date: today, entryId: w.entryId, amount: w.amount };
    return null;
  })();

  const autoFedRef = useRef(false);
  useEffect(() => {
    if (autoFedRef.current) return;
    if (!state.feedAutoEnabled) return;
    if (state.lastFedDate === today) return;
    if (!effectivePlan) return;
    if (!stocks.find((e) => e.id === effectivePlan.entryId)) return;
    autoFedRef.current = true;
    update((s) => ({
      ...s,
      foodStocks: (s.foodStocks ?? []).map((e) =>
        e.id === effectivePlan.entryId
          ? { ...e, amount: Math.max(0, e.amount - effectivePlan.amount) }
          : e,
      ),
      lastFedDate: today,
      lastFedEntryId: effectivePlan.entryId,
      lastFedAmount: effectivePlan.amount,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.feedAutoEnabled, state.lastFedDate, today, effectivePlan?.entryId]);

  const setScheduleSlot = (
    day: DayKey,
    patch: Partial<{ entryId: string; amount: number }>,
  ) => {
    update((s) => {
      const cur = s.feedSchedule?.[day] ?? { entryId: "", amount: 0 };
      return {
        ...s,
        feedSchedule: { ...(s.feedSchedule ?? {}), [day]: { ...cur, ...patch } },
      };
    });
  };

  const setOverride = (
    patch: Partial<{ entryId: string; amount: number }> | null,
  ) => {
    update((s) => {
      if (patch === null) return { ...s, feedOverride: null };
      const cur = s.feedOverride && s.feedOverride.date === today
        ? s.feedOverride
        : { date: today, entryId: "", amount: 0 };
      return {
        ...s,
        feedOverride: { ...cur, date: today, ...patch },
      };
    });
  };

  const [autoConfigOpen, setAutoConfigOpen] = useState(false);

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

      {stocks.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!state.feedAutoEnabled}
                onChange={(v) =>
                  update((s) => ({ ...s, feedAutoEnabled: v }))
                }
                label={
                  <span className="text-sm text-slate-200 font-semibold">
                    🤖 Automatisch abziehen am Tagesanfang
                  </span>
                }
              />
            </div>
            <button
              type="button"
              className="text-xs text-emerald-300 hover:text-emerald-200 underline"
              onClick={() => setAutoConfigOpen((v) => !v)}
            >
              {autoConfigOpen ? "Plan ausblenden" : "Plan bearbeiten"}
            </button>
          </div>

          {(state.feedAutoEnabled || autoConfigOpen) && effectivePlan && (
            <div className="mt-2 text-xs text-slate-400">
              Heute geplant:{" "}
              <span className="text-emerald-300">
                {stocks.find((e) => e.id === effectivePlan.entryId)?.name ??
                  "(unbekannt)"}{" "}
                · {effectivePlan.amount}{" "}
                {stocks.find((e) => e.id === effectivePlan.entryId)?.unit ??
                  "g"}
              </span>{" "}
              {state.feedAutoEnabled && state.lastFedDate === today && (
                <span className="text-slate-500">— heute schon abgezogen</span>
              )}
            </div>
          )}

          {autoConfigOpen && (
            <div className="mt-3 space-y-3">
              {/* Heute (Override) */}
              <div className="rounded border border-emerald-800 bg-emerald-900/20 p-2">
                <div className="text-xs font-semibold text-emerald-200 mb-2">
                  Nur für heute (überschreibt Wochenplan)
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <Select<string>
                      value={
                        state.feedOverride?.date === today
                          ? state.feedOverride.entryId
                          : ""
                      }
                      onChange={(v) => {
                        if (!v) return;
                        const e = stocks.find((s) => s.id === v);
                        setOverride({
                          entryId: v,
                          amount: e ? suggestedAmount(e) : 0,
                        });
                      }}
                      options={[
                        { value: "", label: "— kein Override —" },
                        ...stocks.map((e) => ({
                          value: e.id,
                          label: e.name || "(ohne Name)",
                        })),
                      ]}
                    />
                  </div>
                  <div className="w-28">
                    <NumberInput
                      value={
                        state.feedOverride?.date === today
                          ? state.feedOverride.amount || ""
                          : ""
                      }
                      onChange={(v) =>
                        setOverride({ amount: Math.max(0, v) })
                      }
                      min={0}
                      placeholder="Menge"
                    />
                  </div>
                  {state.feedOverride?.date === today && (
                    <Button tone="slate" onClick={() => setOverride(null)}>
                      Override entfernen
                    </Button>
                  )}
                </div>
              </div>

              {/* Wochenplan */}
              <div>
                <div className="text-xs font-semibold text-slate-200 mb-2">
                  Standard pro Wochentag
                </div>
                <div className="space-y-1">
                  {DAYS.map((day) => {
                    const slot = state.feedSchedule?.[day];
                    return (
                      <div
                        key={day}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <div className="w-24 text-sm text-slate-300">
                          {day}
                        </div>
                        <div className="flex-1 min-w-[160px]">
                          <Select<string>
                            value={slot?.entryId ?? ""}
                            onChange={(v) => {
                              if (!v) {
                                setScheduleSlot(day, { entryId: "", amount: 0 });
                                return;
                              }
                              const e = stocks.find((s) => s.id === v);
                              setScheduleSlot(day, {
                                entryId: v,
                                amount:
                                  slot?.amount && slot.amount > 0
                                    ? slot.amount
                                    : e
                                      ? suggestedAmount(e)
                                      : 0,
                              });
                            }}
                            options={[
                              { value: "", label: "— nichts —" },
                              ...stocks.map((e) => ({
                                value: e.id,
                                label: e.name || "(ohne Name)",
                              })),
                            ]}
                          />
                        </div>
                        <div className="w-24">
                          <NumberInput
                            value={slot?.amount || ""}
                            onChange={(v) =>
                              setScheduleSlot(day, { amount: Math.max(0, v) })
                            }
                            min={0}
                            placeholder="Menge"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <Button
          tone="emerald"
          onClick={openFeedDialog}
          disabled={fedToday || stocks.length === 0}
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

      {feedOpen && (
        <div className="mt-3 rounded-lg border border-emerald-700 bg-emerald-900/30 p-3 space-y-2">
          <div className="font-semibold text-emerald-200">
            Was hast du gefüttert?
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-slate-300 block mb-1">
                Futter
              </label>
              <Select<string>
                value={feedEntryId}
                onChange={(v) => {
                  setFeedEntryId(v);
                  const e = stocks.find((s) => s.id === v);
                  if (e) setFeedAmount(suggestedAmount(e));
                }}
                options={stocks.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${formatAmount(e.amount, e.unit)})`,
                }))}
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-300 block mb-1">
                Menge ({stocks.find((e) => e.id === feedEntryId)?.unit ?? "g"})
              </label>
              <NumberInput
                value={feedAmount || ""}
                onChange={(v) => setFeedAmount(Math.max(0, v))}
                min={0}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button tone="slate" onClick={() => setFeedOpen(false)}>
              Abbrechen
            </Button>
            <Button
              tone="emerald"
              onClick={confirmFeed}
              disabled={!feedEntryId || feedAmount <= 0}
            >
              Bestätigen
            </Button>
          </div>
        </div>
      )}

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
