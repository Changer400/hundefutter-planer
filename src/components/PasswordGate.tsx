import { useState, type FormEvent } from "react";
import {
  hasAnyAccount,
  loginAccount,
  registerAccount,
} from "../lib/auth";

type Mode = "login" | "register";

export function PasswordGate({
  onUnlock,
}: {
  onUnlock: (username: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(hasAnyAccount() ? "login" : "register");
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setErr(null);
    setPw("");
    setPw2("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null);

    if (mode === "register" && pw !== pw2) {
      setErr("Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "register"
          ? await registerAccount(user, pw)
          : await loginAccount(user, pw);
      if (result.ok) {
        onUnlock(result.username);
      } else {
        setErr(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-slate-900 rounded-xl shadow-lg p-6 space-y-4 border border-slate-800"
      >
        <div className="text-center">
          <div className="text-3xl">🐕</div>
          <h1 className="text-xl font-semibold text-emerald-300 mt-1">
            Hundefutter-Planer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isRegister ? "Konto anlegen" : "Anmelden"}
          </p>
        </div>
        <label className="block">
          <span className="text-sm text-slate-300">Benutzername</span>
          <input
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete={isRegister ? "username" : "username"}
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Passwort</span>
          <input
            type="password"
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>
        {isRegister && (
          <label className="block">
            <span className="text-sm text-slate-300">Passwort bestätigen</span>
            <input
              type="password"
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-2 disabled:opacity-60"
        >
          {loading ? "..." : isRegister ? "Konto anlegen" : "Einloggen"}
        </button>
        <div className="text-center text-sm text-slate-400">
          {isRegister ? (
            <button
              type="button"
              className="underline hover:text-emerald-300"
              onClick={() => switchMode("login")}
            >
              Schon ein Konto? Einloggen
            </button>
          ) : (
            <button
              type="button"
              className="underline hover:text-emerald-300"
              onClick={() => switchMode("register")}
            >
              Noch kein Konto? Registrieren
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 text-center">
          Konten und Daten werden nur in diesem Browser gespeichert – sie werden
          nicht auf einen Server gesendet und nicht zwischen Geräten
          synchronisiert.
        </p>
      </form>
    </div>
  );
}
