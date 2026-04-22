const ACCOUNTS_KEY = "hp:accounts:v1";
const CURRENT_KEY = "hp:currentUser:v1";
const LEGACY_DATA_KEY = "hundefutter-planer:v1";

export type Account = {
  username: string;
  passwordHash: string;
  createdAt: number;
};

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Account =>
        !!a &&
        typeof a.username === "string" &&
        typeof a.passwordHash === "string",
    );
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* noop */
  }
}

export function hasAnyAccount(): boolean {
  return loadAccounts().length > 0;
}

export function findAccount(username: string): Account | undefined {
  const normalized = username.trim().toLowerCase();
  return loadAccounts().find((a) => a.username.toLowerCase() === normalized);
}

export function getCurrentUser(): string | null {
  try {
    const u = localStorage.getItem(CURRENT_KEY);
    if (!u) return null;
    return findAccount(u) ? u : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(username: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, username);
  } catch {
    /* noop */
  }
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(CURRENT_KEY);
  } catch {
    /* noop */
  }
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const trimmed = username.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Benutzername zu kurz (min. 2 Zeichen)." };
  }
  if (!/^[\w.\-äöüÄÖÜß ]+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Ungültige Zeichen im Benutzernamen.",
    };
  }
  if (password.length < 6) {
    return { ok: false, error: "Passwort zu kurz (min. 6 Zeichen)." };
  }
  if (findAccount(trimmed)) {
    return { ok: false, error: "Benutzername existiert bereits." };
  }
  const passwordHash = await sha256Hex(password);
  const accounts = loadAccounts();
  const isFirstAccount = accounts.length === 0;
  accounts.push({
    username: trimmed,
    passwordHash,
    createdAt: Date.now(),
  });
  saveAccounts(accounts);

  // If this is the very first account on this browser, migrate any
  // legacy single-user app data to the new per-user key so the owner
  // keeps their existing inputs.
  if (isFirstAccount) {
    try {
      const legacy = localStorage.getItem(LEGACY_DATA_KEY);
      if (legacy !== null) {
        const userKey = `hp:data:${trimmed}`;
        if (localStorage.getItem(userKey) === null) {
          localStorage.setItem(userKey, legacy);
        }
        localStorage.removeItem(LEGACY_DATA_KEY);
      }
    } catch {
      /* noop */
    }
  }

  setCurrentUser(trimmed);
  return { ok: true, username: trimmed };
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const account = findAccount(username);
  if (!account) {
    return { ok: false, error: "Benutzername oder Passwort falsch." };
  }
  const hash = await sha256Hex(password);
  if (hash !== account.passwordHash) {
    return { ok: false, error: "Benutzername oder Passwort falsch." };
  }
  setCurrentUser(account.username);
  return { ok: true, username: account.username };
}
