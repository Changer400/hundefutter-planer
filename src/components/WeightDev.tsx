import { ageInWeeks } from "../lib/calc";
import type { AppState } from "../lib/types";
import { Card } from "./ui";

interface Row {
  weeks: number;
  months: number;
  phase: "Welpe" | "Junghund" | "Heranwachsend" | "Erwachsen";
  weightKg: number;
  barfGPerDay: number;
  tfGPerDay: number;
  meals: number;
}

const rows: Row[] = [
  { weeks: 8, months: 1.8, phase: "Welpe", weightKg: 6, barfGPerDay: 480, tfGPerDay: 160, meals: 4 },
  { weeks: 10, months: 2.3, phase: "Welpe", weightKg: 8, barfGPerDay: 640, tfGPerDay: 213, meals: 4 },
  { weeks: 12, months: 2.8, phase: "Welpe", weightKg: 10, barfGPerDay: 800, tfGPerDay: 267, meals: 4 },
  { weeks: 14, months: 3.2, phase: "Welpe", weightKg: 12, barfGPerDay: 960, tfGPerDay: 320, meals: 4 },
  { weeks: 16, months: 3.7, phase: "Welpe", weightKg: 14, barfGPerDay: 1120, tfGPerDay: 373, meals: 3 },
  { weeks: 20, months: 4.6, phase: "Junghund", weightKg: 17, barfGPerDay: 1190, tfGPerDay: 397, meals: 3 },
  { weeks: 24, months: 5.5, phase: "Junghund", weightKg: 20, barfGPerDay: 1400, tfGPerDay: 467, meals: 3 },
  { weeks: 28, months: 6.5, phase: "Junghund", weightKg: 22, barfGPerDay: 1100, tfGPerDay: 367, meals: 2 },
  { weeks: 32, months: 7.4, phase: "Junghund", weightKg: 24, barfGPerDay: 1200, tfGPerDay: 400, meals: 2 },
  { weeks: 36, months: 8.3, phase: "Junghund", weightKg: 25.5, barfGPerDay: 1275, tfGPerDay: 425, meals: 2 },
  { weeks: 40, months: 9.2, phase: "Junghund", weightKg: 27, barfGPerDay: 1350, tfGPerDay: 450, meals: 2 },
  { weeks: 44, months: 10.2, phase: "Junghund", weightKg: 28, barfGPerDay: 1400, tfGPerDay: 467, meals: 2 },
  { weeks: 48, months: 11.1, phase: "Junghund", weightKg: 29, barfGPerDay: 1450, tfGPerDay: 483, meals: 2 },
  { weeks: 52, months: 12, phase: "Junghund", weightKg: 29.5, barfGPerDay: 738, tfGPerDay: 246, meals: 2 },
  { weeks: 60, months: 13.9, phase: "Heranwachsend", weightKg: 30, barfGPerDay: 750, tfGPerDay: 250, meals: 2 },
  { weeks: 68, months: 15.7, phase: "Heranwachsend", weightKg: 30.5, barfGPerDay: 763, tfGPerDay: 254, meals: 2 },
  { weeks: 78, months: 18, phase: "Erwachsen", weightKg: 31, barfGPerDay: 775, tfGPerDay: 258, meals: 2 },
];

const phaseColor: Record<Row["phase"], string> = {
  Welpe: "text-lime-300",
  Junghund: "text-cyan-300",
  Heranwachsend: "text-orange-300",
  Erwachsen: "text-pink-300",
};

export function WeightDev({ state }: { state: AppState }) {
  const currentWeeks = ageInWeeks(state.birthDate);
  // nearest row by weeks
  let activeIdx = -1;
  if (state.birthDate) {
    let bestDiff = Infinity;
    rows.forEach((r, i) => {
      const diff = Math.abs(r.weeks - currentWeeks);
      if (diff < bestDiff) {
        bestDiff = diff;
        activeIdx = i;
      }
    });
  }

  return (
    <Card
      title="📈 Gewichtsentwicklung – Deutscher Schäferhund Hündin"
      tone="blue"
      subtitle="Richtwerte – individuelle Abweichungen normal (Tierarzt fragen)"
    >
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-blue-950/60 text-blue-200">
            <tr>
              <th className="px-2 py-2 text-left">Alter (Wochen)</th>
              <th className="px-2 py-2 text-left">Alter (Monate)</th>
              <th className="px-2 py-2 text-left">Altersphase</th>
              <th className="px-2 py-2 text-right">Gewicht (kg)</th>
              <th className="px-2 py-2 text-right">BARF/Tag (g)</th>
              <th className="px-2 py-2 text-right">TF/Tag (g)</th>
              <th className="px-2 py-2 text-right">Mahlzeiten</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isActive = i === activeIdx;
              return (
                <tr
                  key={r.weeks}
                  className={
                    isActive
                      ? "bg-emerald-950/60"
                      : "odd:bg-slate-900/40 even:bg-slate-900/20"
                  }
                >
                  <td className="px-2 py-2 font-semibold">
                    {r.weeks}
                    {isActive && (
                      <span className="ml-1 text-emerald-300">◀</span>
                    )}
                  </td>
                  <td className="px-2 py-2">{r.months}</td>
                  <td className={`px-2 py-2 italic ${phaseColor[r.phase]}`}>
                    {r.phase}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {r.weightKg}
                  </td>
                  <td className="px-2 py-2 text-right text-lime-300 font-bold">
                    {r.barfGPerDay}
                  </td>
                  <td className="px-2 py-2 text-right text-amber-300 font-bold">
                    {r.tfGPerDay}
                  </td>
                  <td className="px-2 py-2 text-right">{r.meals}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
