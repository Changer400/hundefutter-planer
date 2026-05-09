import type { AppState, FoodType } from "../lib/types";
import {
  ageInMonths,
  ageInWeeks,
  dailyAmounts,
  formatHumanAge,
  humanAgeYears,
  perMeal,
} from "../lib/calc";
import { Card, DateInput, Field, NumberInput, Select } from "./ui";

export function InputSection({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const weeks = ageInWeeks(state.birthDate);
  const months = ageInMonths(state.birthDate);
  const d = dailyAmounts(state.weightKg, months);
  const humanYears = humanAgeYears(months, state.weightKg);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="🐾 Eingabe – bitte anpassen" tone="green">
        <Field label="Geburtsdatum des Hundes">
          <DateInput
            value={state.birthDate}
            onChange={(v) => update((s) => ({ ...s, birthDate: v }))}
          />
        </Field>
        <Field label="Aktuelles Gewicht (kg)">
          <NumberInput
            value={state.weightKg || ""}
            onChange={(v) =>
              update((s) => ({ ...s, weightKg: Math.max(0, v) }))
            }
            min={0}
            step={0.1}
            placeholder="z. B. 8"
          />
        </Field>
        <Field
          label="Futterart für alle Tage"
          hint="Im Wochenplan kann jeder Tag einzeln angepasst werden."
        >
          <Select<FoodType>
            value={state.defaultFoodType}
            onChange={(v) =>
              update((s) => {
                const weekPlan = { ...s.weekPlan };
                (Object.keys(weekPlan) as (keyof typeof weekPlan)[]).forEach(
                  (k) => (weekPlan[k] = v),
                );
                return { ...s, defaultFoodType: v, weekPlan };
              })
            }
            options={[
              { value: "TF", label: "🥣 Trockenfutter" },
              { value: "BARF", label: "🥩 BARF" },
            ]}
          />
        </Field>

        <div className="mt-3 rounded border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">
          <div className="font-semibold mb-1">
            ℹ️ BARF = Biologisch Artgerechtes Rohes Futter
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-emerald-200/90">
            <li>Welpen &lt; 4 Mon: 8% KG/Tag – 4×/Tag</li>
            <li>Welpen 4–6 Mon: 7% KG/Tag – 3×/Tag</li>
            <li>6–12 Mon: 5% KG/Tag – 2×/Tag</li>
            <li>Erwachsen: 2,5% KG/Tag – 2×/Tag</li>
          </ul>
        </div>
      </Card>

      <Card title="📊 Berechnete Werte (automatisch)" tone="green">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-800">
            <Row label="Alter (Wochen):" value={weeks.toFixed(1)} unit="Wo" />
            <Row label="Alter (Monate):" value={months.toFixed(1)} unit="Mon" />
            <Row
              label="🧑 Menschenalter (ca.):"
              value={formatHumanAge(humanYears)}
            />
            <Row
              label="BARF-Anteil (% vom KG/Tag):"
              value={`${Math.round(d.barfPct * 100)}%`}
            />
            <Row
              label="BARF-Menge / Tag:"
              value={`${d.barfGPerDay} g`}
              unit="Rohfutter gesamt"
            />
            <Row
              label="Trockenfutter / Tag:"
              value={`${d.tfGPerDay} g`}
              unit="TF gesamt"
            />
            <Row label="Mahlzeiten pro Tag:" value={d.mealsPerDay} />
            <Row
              label="BARF pro Mahlzeit:"
              value={`${perMeal(d.barfGPerDay, d.mealsPerDay)} g`}
            />
            <Row
              label="Trockenfutter / Mahlzeit:"
              value={`${perMeal(d.tfGPerDay, d.mealsPerDay)} g`}
            />
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <tr>
      <th className="text-left text-slate-300 font-medium py-2 pr-2 align-top">
        {label}
      </th>
      <td className="py-2 text-right">
        <span className="text-amber-300 font-bold text-lg">{value}</span>
        {unit && (
          <span className="ml-2 text-xs italic text-slate-400">{unit}</span>
        )}
      </td>
    </tr>
  );
}
