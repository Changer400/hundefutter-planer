export type AuthResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

async function parseErr(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* noop */
  }
  return `Serverfehler (${res.status}).`;
}

export async function checkAuth(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    const body = (await res.json()) as { user: { username: string } | null };
    return body.user ? body.user.username : null;
  } catch {
    return null;
  }
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      return { ok: false, error: await parseErr(res) };
    }
    const body = (await res.json()) as { user: { username: string } };
    return { ok: true, username: body.user.username };
  } catch {
    return { ok: false, error: "Netzwerkfehler." };
  }
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      return { ok: false, error: await parseErr(res) };
    }
    const body = (await res.json()) as { user: { username: string } };
    return { ok: true, username: body.user.username };
  } catch {
    return { ok: false, error: "Netzwerkfehler." };
  }
}

export async function logoutAccount(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* noop */
  }
}
