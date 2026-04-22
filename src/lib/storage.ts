import { useEffect, useState } from "react";
import type { AppState, DayKey } from "./types";

function dataKey(username: string): string {
  return `hp:data:${username}`;
}

export function defaultState(): AppState {
  const weekPlan = {} as Record<DayKey, "TF" | "BARF">;
  (
    [
      "Montag",
      "Dienstag",
      "Mittwoch",
      "Donnerstag",
      "Freitag",
      "Samstag",
      "Sonntag",
    ] as DayKey[]
  ).forEach((d) => (weekPlan[d] = "TF"));

  return {
    birthDate: "",
    weightKg: 8,
    defaultFoodType: "TF",
    stockG: 0,
    lastFedDate: null,
    reminders: {
      morgens: "07:00",
      mittags: "12:00",
      nachmittags: "16:00",
      abends: "19:00",
    },
    weekPlan,
    shoppingDone: {},
    customShopping: Array.from({ length: 8 }).map((_, i) => ({
      id: `custom-${i}`,
      name: "",
      amount: "",
      note: "",
      done: false,
    })),
    appointments: builtinAppointments(),
  };
}

export function builtinAppointments() {
  return [
    {
      id: "a1",
      date: "8. Woche",
      treatment: "1. Impfung (SHPPi + Lepto)",
      status: "Offen" as const,
      notes: "Grundimmunisierung Staupe, Hepatitis, Parvo, Parainfluenza, Leptospirose",
      next: "12. Woche",
      builtin: true,
    },
    {
      id: "a2",
      date: "8. Woche",
      treatment: "1. Entwurmung beim neuen Besitzer",
      status: "Offen" as const,
      notes: "Wurmkur vom Tierarzt",
      next: "12. Woche",
      builtin: true,
    },
    {
      id: "a3",
      date: "12. Woche",
      treatment: "2. Impfung (SHPPi + Lepto)",
      status: "Offen" as const,
      notes: "Wiederholimpfung",
      next: "16. Woche",
      builtin: true,
    },
    {
      id: "a4",
      date: "12. Woche",
      treatment: "2. Entwurmung",
      status: "Offen" as const,
      notes: "Wurmkur",
      next: "16. Woche",
      builtin: true,
    },
    {
      id: "a5",
      date: "16. Woche",
      treatment: "3. Impfung (SHPPi + Lepto + Tollwut)",
      status: "Offen" as const,
      notes: "Tollwut-Erstimpfung!",
      next: "15. Monat",
      builtin: true,
    },
    {
      id: "a6",
      date: "16. Woche",
      treatment: "3. Entwurmung",
      status: "Offen" as const,
      notes: "Wurmkur",
      next: "20. Woche",
      builtin: true,
    },
    {
      id: "a7",
      date: "20. Woche",
      treatment: "4. Entwurmung",
      status: "Offen" as const,
      notes: "Wurmkur",
      next: "24. Woche",
      builtin: true,
    },
    {
      id: "a8",
      date: "24. Woche",
      treatment: "5. Entwurmung",
      status: "Offen" as const,
      notes: "Wurmkur, danach alle 3 Monate",
      next: "36. Woche",
      builtin: true,
    },
    {
      id: "a9",
      date: "6. Monat",
      treatment: "Zahnkontrolle",
      status: "Offen" as const,
      notes: "Zahnwechsel prüfen, ggf. Milchzähne ziehen",
      next: "",
      builtin: true,
    },
    {
      id: "a10",
      date: "6. Monat",
      treatment: "Kastrations-Beratung",
      status: "Offen" as const,
      notes: "Mit Tierarzt besprechen (Zeitpunkt)",
      next: "",
      builtin: true,
    },
    {
      id: "a11",
      date: "15. Monat",
      treatment: "Jahresimpfung (SHPPi + Lepto + Tollwut)",
      status: "Offen" as const,
      notes: "Auffrischung, danach jährlich",
      next: "",
      builtin: true,
    },
    {
      id: "a12",
      date: "",
      treatment: "Chip-Registrierung (TASSO)",
      status: "Offen" as const,
      notes: "Falls noch nicht erfolgt",
      next: "",
      builtin: true,
    },
    {
      id: "a13",
      date: "",
      treatment: "Haftpflichtversicherung",
      status: "Offen" as const,
      notes: "Hundehaftpflicht abschließen!",
      next: "",
      builtin: true,
    },
  ];
}

export function loadState(username: string): AppState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(dataKey(username));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export function saveState(username: string, state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dataKey(username), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useAppState(
  username: string,
): [AppState, (u: (s: AppState) => AppState) => void] {
  const [state, setState] = useState<AppState>(() => loadState(username));

  useEffect(() => {
    saveState(username, state);
  }, [username, state]);

  const update = (u: (s: AppState) => AppState) => setState((s) => u(s));
  return [state, update];
}
