import type { AppState, FoodType } from "../lib/types";
import { DAYS } from "../lib/types";
import {
  ageInMonths,
  dailyAmounts,
  perMeal,
  todayKey,
} from "../lib/calc";
import { Card, Select } from "./ui";

export function WeekPlan({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const months = ageInMonths(state.birthDate);
  const d = dailyAmounts(state.weightKg, months);
  const today = todayKey();

  const barfDays = DAYS.filter((day) => state.weekPlan[day] === "BARF").length;
  const tfDays = DAYS.filter((day) => state.weekPlan[day] === "TF").length;
  const weekTotal =
    barfDays * d.barfGPerDay + tfDays * d.tfGPerDay;

  // Determine "current meal arrow" — first meal whose time is >= now
  const currentMeal = (() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const entries: { key: "morgens" | "mittags" | "nachmittags" | "abends"; min: number }[] = (
      ["morgens", "mittags", "nachmittags", "abends"] as const
    ).map((k) => {
      const [hh, mm] = (state.reminders[k] || "00:00").split(":").map(Number);
      return { key: k, min: hh * 60 + mm };
    });
    const next = entries.find((e) => e.min >= nowMin);
    return next?.key ?? "morgens";
  })();

  return (
    <Card title="📅 Wochenplan – Futterart pro Tag wählbar" tone="blue">
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-blue-950/60 text-blue-200">
            <tr>
              <th className="px-2 py-2 text-left">Tag</th>
              <th className="px-2 py-2 text-left">Futterart ▼</th>
              <th className="px-2 py-2 text-right">Menge/Mahlzeit</th>
              <th className="px-2 py-2 text-right">Mahlzeiten</th>
              <th className="px-2 py-2 text-right">Tages-Menge</th>
              <th
                className={`px-2 py-2 text-right ${currentMeal === "morgens" ? "bg-emerald-900/60 text-emerald-200" : ""}`}
              >
                {currentMeal === "morgens" ? "▶ " : ""}Morgens (g)
              </th>
              <th
                className={`px-2 py-2 text-right ${currentMeal === "mittags" ? "bg-emerald-900/60 text-emerald-200" : ""}`}
              >
                {currentMeal === "mittags" ? "▶ " : ""}Mittags (g)
              </th>
              <th
                className={`px-2 py-2 text-right ${currentMeal === "nachmittags" ? "bg-emerald-900/60 text-emerald-200" : ""}`}
              >
                {currentMeal === "nachmittags" ? "▶ " : ""}Nachmittags (g)
              </th>
              <th
                className={`px-2 py-2 text-right ${currentMeal === "abends" ? "bg-emerald-900/60 text-emerald-200" : ""}`}
              >
                {currentMeal === "abends" ? "▶ " : ""}Abends (g)
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => {
              const type = state.weekPlan[day];
              const perDay = type === "BARF" ? d.barfGPerDay : d.tfGPerDay;
              const pm = perMeal(perDay, d.mealsPerDay);
              const isToday = day === today;
              return (
                <tr
                  key={day}
                  className={
                    isToday
                      ? "bg-emerald-950/60"
                      : "odd:bg-slate-900/40 even:bg-slate-900/20"
                  }
                >
                  <td className="px-2 py-2 font-semibold">
                    {day}
                    {isToday && (
                      <span className="ml-2 text-xs text-emerald-300">
                        ◀ Heute
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Select<FoodType>
                      value={type}
                      onChange={(v) =>
                        update((s) => ({
                          ...s,
                          weekPlan: { ...s.weekPlan, [day]: v },
                        }))
                      }
                      options={[
                        { value: "TF", label: "🥣 Trockenfutter" },
                        { value: "BARF", label: "🥩 BARF" },
                      ]}
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-amber-300 font-bold">
                    {pm} g
                  </td>
                  <td className="px-2 py-2 text-right">{d.mealsPerDay}</td>
                  <td className="px-2 py-2 text-right text-amber-300 font-bold">
                    {perDay} g
                  </td>
                  <td
                    className={`px-2 py-2 text-right ${isToday && currentMeal === "morgens" ? "text-emerald-200 font-bold" : "text-slate-300"}`}
                  >
                    {isToday && currentMeal === "morgens" ? "▶ " : ""}
                    {pm} g
                  </td>
                  <td
                    className={`px-2 py-2 text-right ${isToday && currentMeal === "mittags" ? "text-emerald-200 font-bold" : "text-slate-300"}`}
                  >
                    {isToday && currentMeal === "mittags" ? "▶ " : ""}
                    {pm} g
                  </td>
                  <td
                    className={`px-2 py-2 text-right ${isToday && currentMeal === "nachmittags" ? "text-emerald-200 font-bold" : "text-slate-300"}`}
                  >
                    {isToday && currentMeal === "nachmittags" ? "▶ " : ""}
                    {pm} g
                  </td>
                  <td
                    className={`px-2 py-2 text-right ${isToday && currentMeal === "abends" ? "text-emerald-200 font-bold" : "text-slate-300"}`}
                  >
                    {isToday && currentMeal === "abends" ? "▶ " : ""}
                    {pm} g
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-blue-950/60 text-blue-100 font-semibold">
              <td className="px-2 py-2" colSpan={4}>
                Wochenmenge gesamt (g):
              </td>
              <td className="px-2 py-2 text-right text-lg">
                {weekTotal.toLocaleString("de-DE")} g
              </td>
              <td colSpan={4} />
            </tr>
            <tr className="text-xs text-slate-400">
              <td className="px-2 py-2" colSpan={4}>
                Anzahl BARF-Tage:{" "}
                <span className="text-pink-300 font-semibold">{barfDays}</span>
                {"   "}Anzahl TF-Tage:{" "}
                <span className="text-amber-300 font-semibold">{tfDays}</span>
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
