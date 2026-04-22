import { useState, type FormEvent } from "react";
import { getAuthHash, setUnlocked, sha256Hex } from "../lib/auth";

export function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const hash = await sha256Hex(`${user}:${pw}`);
      if (hash === getAuthHash()) {
        setUnlocked();
        onUnlock();
      } else {
        setErr("Benutzername oder Passwort falsch.");
      }
    } finally {
      setLoading(false);
    }
  }

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
          <p className="text-sm text-slate-400 mt-1">Bitte einloggen.</p>
        </div>
        <label className="block">
          <span className="text-sm text-slate-300">Benutzername</span>
          <input
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Passwort</span>
          <input
            type="password"
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-2 disabled:opacity-60"
        >
          {loading ? "..." : "Einloggen"}
        </button>
      </form>
    </div>
  );
}
