import type { AppState, Appointment, AppointmentStatus } from "../lib/types";
import { Button, Card, Select, TextInput } from "./ui";

const statusTone: Record<AppointmentStatus, string> = {
  Offen: "bg-amber-900/50 border-amber-700 text-amber-200",
  Erledigt: "bg-emerald-900/50 border-emerald-700 text-emerald-200",
  Verschoben: "bg-slate-700/60 border-slate-600 text-slate-200",
};

export function Appointments({
  state,
  update,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
}) {
  const builtinAppts = state.appointments.filter((a) => a.builtin);
  const customAppts = state.appointments.filter((a) => !a.builtin);

  const setField = <K extends keyof Appointment>(
    id: string,
    key: K,
    value: Appointment[K],
  ) => {
    update((s) => ({
      ...s,
      appointments: s.appointments.map((a) =>
        a.id === id ? { ...a, [key]: value } : a,
      ),
    }));
  };

  const addCustom = () => {
    update((s) => ({
      ...s,
      appointments: [
        ...s.appointments,
        {
          id: `custom-${Date.now()}`,
          date: "",
          treatment: "",
          status: "Offen",
          notes: "",
          next: "",
        },
      ],
    }));
  };

  const removeCustom = (id: string) => {
    update((s) => ({
      ...s,
      appointments: s.appointments.filter((a) => a.id !== id),
    }));
  };

  return (
    <Card
      title="🗓️ Termine & Impfungen – Schäferhund Welpe (Hündin)"
      tone="blue"
      subtitle="Alle Impfungen, Entwurmungen und Tierarztbesuche dokumentieren"
    >
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-blue-950/60 text-blue-200">
            <tr>
              <th className="px-2 py-2 text-left">Datum</th>
              <th className="px-2 py-2 text-left">Behandlung</th>
              <th className="px-2 py-2 text-left">Status ▼</th>
              <th className="px-2 py-2 text-left">Notizen</th>
              <th className="px-2 py-2 text-left">Nächster Termin</th>
            </tr>
          </thead>
          <tbody>
            {builtinAppts.map((a) => (
              <tr
                key={a.id}
                className="odd:bg-slate-900/40 even:bg-slate-900/20"
              >
                <td className="px-2 py-2 font-semibold">{a.date}</td>
                <td className="px-2 py-2">{a.treatment}</td>
                <td className="px-2 py-2">
                  <div
                    className={`inline-block rounded border ${statusTone[a.status]} px-1`}
                  >
                    <Select<AppointmentStatus>
                      value={a.status}
                      onChange={(v) => setField(a.id, "status", v)}
                      options={[
                        { value: "Offen", label: "Offen" },
                        { value: "Erledigt", label: "Erledigt" },
                        { value: "Verschoben", label: "Verschoben" },
                      ]}
                      className="!bg-transparent !border-none !py-1 !text-inherit"
                    />
                  </div>
                </td>
                <td className="px-2 py-2 italic text-slate-300">{a.notes}</td>
                <td className="px-2 py-2 text-blue-300">{a.next}</td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={5}
                className="text-center text-purple-200 font-semibold py-2 bg-purple-950/60"
              >
                ✍️ Eigene Termine eintragen:
              </td>
            </tr>
            {customAppts.map((a) => (
              <tr
                key={a.id}
                className="odd:bg-slate-900/30 even:bg-slate-900/10"
              >
                <td className="px-1 py-1">
                  <TextInput
                    value={a.date}
                    onChange={(v) => setField(a.id, "date", v)}
                    placeholder="..."
                  />
                </td>
                <td className="px-1 py-1">
                  <TextInput
                    value={a.treatment}
                    onChange={(v) => setField(a.id, "treatment", v)}
                    placeholder="..."
                  />
                </td>
                <td className="px-1 py-1">
                  <div
                    className={`inline-block rounded border ${statusTone[a.status]} px-1`}
                  >
                    <Select<AppointmentStatus>
                      value={a.status}
                      onChange={(v) => setField(a.id, "status", v)}
                      options={[
                        { value: "Offen", label: "Offen" },
                        { value: "Erledigt", label: "Erledigt" },
                        { value: "Verschoben", label: "Verschoben" },
                      ]}
                      className="!bg-transparent !border-none !py-1 !text-inherit"
                    />
                  </div>
                </td>
                <td className="px-1 py-1">
                  <TextInput
                    value={a.notes}
                    onChange={(v) => setField(a.id, "notes", v)}
                    placeholder="..."
                  />
                </td>
                <td className="px-1 py-1 flex gap-1">
                  <TextInput
                    value={a.next}
                    onChange={(v) => setField(a.id, "next", v)}
                    placeholder="..."
                  />
                  <Button
                    tone="red"
                    onClick={() => removeCustom(a.id)}
                    className="!px-2 !py-1 text-xs"
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-center">
        <Button tone="purple" onClick={addCustom}>
          + Eigenen Termin hinzufügen
        </Button>
      </div>
      <div className="mt-4 text-center text-xs italic text-slate-400">
        Bei Unsicherheit immer einen Tierarzt konsultieren. Immer frisches
        Wasser bereitstellen!
      </div>
    </Card>
  );
}
