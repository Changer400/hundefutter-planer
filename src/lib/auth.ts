const STORAGE_KEY = "hp:auth:unlocked:v1";
const AUTH_HASH = (import.meta.env.VITE_AUTH_HASH as string | undefined) ?? "";

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getAuthHash(): string {
  return AUTH_HASH;
}

export function isAuthConfigured(): boolean {
  return AUTH_HASH.length === 64;
}

export function isUnlocked(): boolean {
  if (!isAuthConfigured()) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === AUTH_HASH;
  } catch {
    return false;
  }
}

export function setUnlocked(): void {
  try {
    localStorage.setItem(STORAGE_KEY, AUTH_HASH);
  } catch {
    /* noop */
  }
}

export function lock(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
