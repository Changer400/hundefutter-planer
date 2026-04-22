import { useState } from "react";
import { InputSection } from "./components/InputSection";
import { StockSection } from "./components/StockSection";
import { RemindersSection } from "./components/RemindersSection";
import { WeekPlan } from "./components/WeekPlan";
import { Supplements } from "./components/Supplements";
import { ShoppingList } from "./components/ShoppingList";
import { WeightDev } from "./components/WeightDev";
import { Appointments } from "./components/Appointments";
import { PasswordGate } from "./components/PasswordGate";
import { isAuthConfigured, isUnlocked, lock } from "./lib/auth";
import { useAppState } from "./lib/storage";

function App() {
  const [state, update] = useAppState();
  const [unlocked, setUnlocked] = useState<boolean>(() => isUnlocked());

  if (isAuthConfigured() && !unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="py-6 px-4 text-center border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 relative">
        <h1 className="text-2xl sm:text-3xl font-bold text-emerald-300">
          🐕 Hundefutter-Planer
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          BARF & Trockenfutter · Wochenplan · Einkaufsliste · Termine
        </p>
        {isAuthConfigured() && (
          <button
            type="button"
            onClick={() => {
              lock();
              setUnlocked(false);
            }}
            className="absolute top-4 right-4 text-xs text-slate-400 hover:text-emerald-300 border border-slate-700 rounded px-2 py-1"
          >
            Abmelden
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
        <InputSection state={state} update={update} />
        <StockSection state={state} update={update} />
        <RemindersSection state={state} update={update} />
        <WeekPlan state={state} update={update} />
        <Supplements />
        <ShoppingList state={state} update={update} />
        <WeightDev state={state} />
        <Appointments state={state} update={update} />
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        Alle Daten werden lokal in deinem Browser gespeichert · © Hundefutter-Planer
      </footer>
    </div>
  );
}

export default App;
