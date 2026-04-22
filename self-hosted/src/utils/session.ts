export const SESSION_COOKIE = "hp_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const raw of header.split(";")) {
    const part = raw.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = decodeURIComponent(part.slice(eq + 1).trim());
    if (k) out[k] = v;
  }
  return out;
}

export function buildSessionCookie(
  id: string,
  maxAgeMs: number = SESSION_TTL_MS,
  options: { secure?: boolean } = {},
): string {
  const maxAgeSec = Math.floor(maxAgeMs / 1000);
  const secure = options.secure ?? true;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(options: { secure?: boolean } = {}): string {
  const secure = options.secure ?? true;
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
