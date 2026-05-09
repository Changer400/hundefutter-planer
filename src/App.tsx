import { useEffect, useState } from "react";
import { InputSection } from "./components/InputSection";
import { FoodStocks } from "./components/FoodStocks";
import { RemindersSection } from "./components/RemindersSection";
import { WeekPlan } from "./components/WeekPlan";
import { Supplements } from "./components/Supplements";
import { ShoppingList } from "./components/ShoppingList";
import { WeightDev } from "./components/WeightDev";
import { Appointments } from "./components/Appointments";
import { PasswordGate } from "./components/PasswordGate";
import { checkAuth, logoutAccount } from "./lib/auth";
import { useAppState } from "./lib/storage";

function SyncBadge({
  status,
  saving,
  lastSavedAt,
}: {
  status: "loading" | "ready" | "error";
  saving: boolean;
  lastSavedAt: number | null;
}) {
  let text = "";
  let cls = "text-slate-400";
  if (status === "loading") {
    text = "lädt…";
  } else if (saving) {
    text = "speichert…";
    cls = "text-amber-300";
  } else if (lastSavedAt) {
    text = "synchron";
    cls = "text-emerald-300";
  } else {
    text = "bereit";
  }
  return <span className={`text-xs ${cls}`}>{text}</span>;
}

function AppForUser({
  username,
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) {
  const [state, update, status, sync] = useAppState(username);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="py-6 px-4 text-center border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 relative">
        <h1 className="text-2xl sm:text-3xl font-bold text-emerald-300">
          🐕 Hundefutter-Planer
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          BARF & Trockenfutter · Wochenplan · Einkaufsliste · Termine
        </p>
        <div className="absolute top-4 right-4 flex items-center gap-2 text-xs">
          <SyncBadge
            status={status}
            saving={sync.saving}
            lastSavedAt={sync.lastSavedAt}
          />
          <span className="text-slate-400 hidden sm:inline">
            Eingeloggt als <span className="text-emerald-300">{username}</span>
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="text-slate-400 hover:text-emerald-300 border border-slate-700 rounded px-2 py-1"
          >
            Abmelden
          </button>
        </div>
      </header>

      {status === "loading" ? (
        <main className="max-w-6xl mx-auto p-3 sm:p-6">
          <p className="text-slate-400 text-sm">Daten werden geladen…</p>
        </main>
      ) : (
        <main className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
          <InputSection state={state} update={update} />
          <FoodStocks state={state} update={update} />
          <RemindersSection state={state} update={update} />
          <WeekPlan state={state} update={update} />
          <Supplements />
          <ShoppingList state={state} update={update} />
          <WeightDev state={state} />
          <Appointments state={state} update={update} />
        </main>
      )}

      <footer className="py-6 text-center text-xs text-slate-500">
        Daten werden sicher auf Cloudflare gespeichert · © Hundefutter-Planer
      </footer>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await checkAuth();
      if (cancelled) return;
      setCurrentUser(u);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Laden…
      </div>
    );
  }

  if (!currentUser) {
    return <PasswordGate onUnlock={(u) => setCurrentUser(u)} />;
  }

  return (
    <AppForUser
      key={currentUser}
      username={currentUser}
      onLogout={async () => {
        await logoutAccount();
        setCurrentUser(null);
      }}
    />
  );
}

export default App;
