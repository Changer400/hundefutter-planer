import { Card } from "./ui";

interface SupplementRow {
  name: string;
  dose: string;
  effect: string;
  note: string;
}

const supplements: SupplementRow[] = [
  {
    name: "Lachsöl / Fischöl",
    dose: "1 TL",
    effect: "Omega-3, gesundes Fell",
    note: "Täglich möglich",
  },
  {
    name: "Seealgenpulver",
    dose: "¼ TL",
    effect: "Mineralien, Jod",
    note: "2–3× pro Woche",
  },
  {
    name: "Eierschalenpulver",
    dose: "½ TL",
    effect: "Kalzium",
    note: "Wenn keine Knochen gefüttert",
  },
  {
    name: "Bierhefe",
    dose: "½ TL",
    effect: "B-Vitamine, Haut & Fell",
    note: "Täglich möglich",
  },
  {
    name: "Lebertran (im Winter)",
    dose: "wenige Tropfen",
    effect: "Vitamin D",
    note: "Nur im Winter",
  },
];

export function Supplements() {
  return (
    <Card title="💊 Empfohlene Zusätze (an BARF-Tagen)" tone="yellow">
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-yellow-950/60 text-yellow-200">
            <tr>
              <th className="px-2 py-2 text-left">Zusatz</th>
              <th className="px-2 py-2 text-left">Dosierung</th>
              <th className="px-2 py-2 text-left">Wirkung</th>
              <th className="px-2 py-2 text-left">Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {supplements.map((s) => (
              <tr
                key={s.name}
                className="odd:bg-slate-900/40 even:bg-slate-900/20"
              >
                <td className="px-2 py-2 font-semibold">{s.name}</td>
                <td className="px-2 py-2 text-yellow-300">{s.dose}</td>
                <td className="px-2 py-2 italic text-slate-300">{s.effect}</td>
                <td className="px-2 py-2 text-slate-400">{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
