import type { AppState } from "../lib/types";
import { ageInMonths, dailyAmounts, totalGForType } from "../lib/calc";
import { Card, Checkbox, TextInput } from "./ui";

interface BuiltinRow {
  id: string;
  name: string;
  /** % of BARF total (or null for supplements/unknown) */
  barfPct?: number;
  isTf?: boolean;
  note: string;
  section: "BARF-Zutaten" | "Trockenfutter" | "Zusätze";
}

// Typical BARF composition: ~50% muscle meat, 15% rumen, 15% bones, 10% offal, 10% veg/fruit
const rows: BuiltinRow[] = [
  {
    id: "mf",
    name: "Muskelfleisch (Rind/Huhn)",
    barfPct: 0.5,
    note: "Frisch oder tiefgefroren",
    section: "BARF-Zutaten",
  },
  {
    id: "pansen",
    name: "Pansen / Blättermagen",
    barfPct: 0.15,
    note: "Grüner Pansen bevorzugt",
    section: "BARF-Zutaten",
  },
  {
    id: "knochen",
    name: "Rohe fleischige Knochen",
    barfPct: 0.15,
    note: "Hühnerhälse, Kalbsrippen",
    section: "BARF-Zutaten",
  },
  {
    id: "innereien",
    name: "Innereien (Leber, Herz)",
    barfPct: 0.1,
    note: "Abwechslung wichtig!",
    section: "BARF-Zutaten",
  },
  {
    id: "gemuese",
    name: "Gemüse & Obst (püriert)",
    barfPct: 0.1,
    note: "Karotte, Zucchini, Apfel",
    section: "BARF-Zutaten",
  },
  {
    id: "tf",
    name: "Trockenfutter (hochwertig)",
    isTf: true,
    note: "Getreidefrei empfohlen",
    section: "Trockenfutter",
  },
  {
    id: "lachsoel",
    name: "Lachsöl / Fischöl",
    note: "1 Flasche/Monat",
    section: "Zusätze",
  },
  {
    id: "seealgen",
    name: "Seealgenpulver",
    note: "1 Dose reicht lange",
    section: "Zusätze",
  },
  {
    id: "eierschalen",
    name: "Eierschalenpulver",
    note: "Selbst mahlen oder kaufen",
    section: "Zusätze",
  },
];

export function ShoppingList({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const months = ageInMonths(state.birthDate);
  const d = dailyAmounts(state.weightKg, months, state.customMealsPerDay);
  const barfWeekTotal = totalGForType(
    state.weekPlan,
    state.weightKg,
    months,
    "BARF",
  );
  const tfWeekTotal = totalGForType(
    state.weekPlan,
    state.weightKg,
    months,
    "TF",
  );

  const sections: Array<BuiltinRow["section"]> = [
    "BARF-Zutaten",
    "Trockenfutter",
    "Zusätze",
  ];

  const amountFor = (r: BuiltinRow): string => {
    if (r.isTf) {
      const buffer = Math.round(tfWeekTotal * 1.05); // 5% buffer
      return tfWeekTotal > 0 ? buffer.toLocaleString("de-DE") : "–";
    }
    if (typeof r.barfPct === "number") {
      if (barfWeekTotal === 0) return "–";
      return Math.round(barfWeekTotal * r.barfPct).toLocaleString("de-DE");
    }
    return "–";
  };

  return (
    <Card
      title="🛒 Einkaufsliste (automatisch berechnet)"
      tone="pink"
      subtitle="Mengen passen sich an, wenn du Alter/Gewicht/Futtertage änderst!"
    >
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-pink-950/60 text-pink-200">
            <tr>
              <th className="px-2 py-2 text-left">Produkt</th>
              <th className="px-2 py-2 text-right">Wochenbedarf (g)</th>
              <th className="px-2 py-2 text-left">Hinweis</th>
              <th className="px-2 py-2 text-center">Erledigt</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionRows
                key={section}
                section={section}
                rows={rows.filter((r) => r.section === section)}
                amountFor={amountFor}
                shoppingDone={state.shoppingDone}
                toggle={(id) =>
                  update((s) => ({
                    ...s,
                    shoppingDone: {
                      ...s.shoppingDone,
                      [id]: !s.shoppingDone[id],
                    },
                  }))
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom rows */}
      <div className="mt-6">
        <div className="text-center text-purple-200 font-semibold py-2 bg-purple-950/60 rounded-t border border-purple-900">
          ✍️ Eigene Einträge (einfach in die Zeilen unten tippen!)
        </div>
        <div className="overflow-x-auto -mx-4 px-4 border-x border-b border-purple-900 rounded-b">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-purple-950/40 text-purple-200 text-xs">
              <tr>
                <th className="px-2 py-2 text-left w-1/3">Produkt</th>
                <th className="px-2 py-2 text-left w-1/4">Menge</th>
                <th className="px-2 py-2 text-left">Hinweis</th>
                <th className="px-2 py-2 text-center w-20">Erledigt</th>
              </tr>
            </thead>
            <tbody>
              {state.customShopping.map((row) => (
                <tr
                  key={row.id}
                  className="odd:bg-slate-900/30 even:bg-slate-900/10"
                >
                  <td className="px-1 py-1">
                    <TextInput
                      value={row.name}
                      onChange={(v) =>
                        update((s) => ({
                          ...s,
                          customShopping: s.customShopping.map((r) =>
                            r.id === row.id ? { ...r, name: v } : r,
                          ),
                        }))
                      }
                      placeholder="..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <TextInput
                      value={row.amount}
                      onChange={(v) =>
                        update((s) => ({
                          ...s,
                          customShopping: s.customShopping.map((r) =>
                            r.id === row.id ? { ...r, amount: v } : r,
                          ),
                        }))
                      }
                      placeholder="–"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <TextInput
                      value={row.note}
                      onChange={(v) =>
                        update((s) => ({
                          ...s,
                          customShopping: s.customShopping.map((r) =>
                            r.id === row.id ? { ...r, note: v } : r,
                          ),
                        }))
                      }
                      placeholder="..."
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <Checkbox
                      checked={row.done}
                      onChange={(v) =>
                        update((s) => ({
                          ...s,
                          customShopping: s.customShopping.map((r) =>
                            r.id === row.id ? { ...r, done: v } : r,
                          ),
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-400 text-center">
        Tages-BARF: {d.barfGPerDay} g · Tages-TF: {d.tfGPerDay} g
      </div>
    </Card>
  );
}

function SectionRows({
  section,
  rows,
  amountFor,
  shoppingDone,
  toggle,
}: {
  section: string;
  rows: BuiltinRow[];
  amountFor: (r: BuiltinRow) => string;
  shoppingDone: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="px-2 py-2 italic text-emerald-300 bg-slate-900/60"
        >
          — {section} —
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className="odd:bg-slate-900/40 even:bg-slate-900/20">
          <td className="px-2 py-2 font-semibold">{r.name}</td>
          <td className="px-2 py-2 text-right text-amber-300 font-bold tabular-nums">
            {amountFor(r)}
          </td>
          <td className="px-2 py-2 text-slate-400">{r.note}</td>
          <td className="px-2 py-2 text-center">
            <Checkbox
              checked={!!shoppingDone[r.id]}
              onChange={() => toggle(r.id)}
            />
          </td>
        </tr>
      ))}
    </>
  );
}
