import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, DayKey } from "./types";

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
    foodStocks: [],
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

function mergeWithDefaults(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return defaultState();
  const merged = { ...defaultState(), ...(raw as Partial<AppState>) };
  // Migration: alter `stockG` → erster Eintrag in foodStocks
  if (
    (!merged.foodStocks || merged.foodStocks.length === 0) &&
    merged.stockG > 0
  ) {
    merged.foodStocks = [
      {
        id: `legacy-tf-${Date.now()}`,
        name: "Trockenfutter",
        amount: merged.stockG,
        unit: "g",
        category: "TF",
      },
    ];
  }
  if (!Array.isArray(merged.foodStocks)) {
    merged.foodStocks = [];
  }
  return merged;
}

async function fetchRemoteState(): Promise<AppState | null> {
  try {
    const res = await fetch("/api/state", { credentials: "same-origin" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: unknown };
    if (body.data === null || body.data === undefined) return null;
    return mergeWithDefaults(body.data);
  } catch {
    return null;
  }
}

async function putRemoteState(state: AppState): Promise<void> {
  try {
    await fetch("/api/state", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    /* noop */
  }
}

function readLegacyLocalState(username: string): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`hp:data:${username}`);
    if (!raw) return null;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearLegacyLocalState(username: string): void {
  try {
    window.localStorage.removeItem(`hp:data:${username}`);
  } catch {
    /* noop */
  }
}

export type AppStateStatus = "loading" | "ready" | "error";

export function useAppState(
  username: string,
): [
  AppState,
  (u: (s: AppState) => AppState) => void,
  AppStateStatus,
  { lastSavedAt: number | null; saving: boolean },
] {
  const [state, setState] = useState<AppState>(() => defaultState());
  const [status, setStatus] = useState<AppStateStatus>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;

    (async () => {
      const remote = await fetchRemoteState();
      if (cancelled) return;
      if (remote) {
        setState(remote);
        loadedRef.current = true;
        setStatus("ready");
        return;
      }
      const legacy = readLegacyLocalState(username);
      if (legacy) {
        setState(legacy);
        loadedRef.current = true;
        setStatus("ready");
        setSaving(true);
        await putRemoteState(legacy);
        if (!cancelled) {
          clearLegacyLocalState(username);
          setLastSavedAt(Date.now());
          setSaving(false);
        }
        return;
      }
      setState(defaultState());
      loadedRef.current = true;
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(async () => {
      setSaving(true);
      await putRemoteState(state);
      setLastSavedAt(Date.now());
      setSaving(false);
    }, 500);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [state]);

  const update = useCallback(
    (u: (s: AppState) => AppState) => setState((s) => u(s)),
    [],
  );
  return [state, update, status, { lastSavedAt, saving }];
}
