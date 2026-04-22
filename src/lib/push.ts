function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushCapability =
  | "unsupported"
  | "denied"
  | "default"
  | "granted"
  | "subscribed";

export async function getPushCapability(): Promise<PushCapability> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") return "subscribed";
  }
  return Notification.permission as PushCapability;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-public", {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("VAPID Public Key nicht verfügbar.");
  const j = (await res.json()) as { publicKey: string };
  return j.publicKey;
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { ok: false, error: "Browser unterstützt kein Push." };
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return { ok: false, error: "Benachrichtigungen nicht erlaubt." };
    }
    const reg = await registerServiceWorker();
    // Wait for the service worker to be ready to take subscriptions.
    await navigator.serviceWorker.ready;

    const vapidPublic = await fetchVapidPublicKey();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic)
          .buffer as ArrayBuffer,
      });
    }

    const rawKey = sub.getKey("p256dh");
    const rawAuth = sub.getKey("auth");
    const body = {
      endpoint: sub.endpoint,
      p256dh: bytesToBase64Url(rawKey),
      auth: bytesToBase64Url(rawAuth),
    };
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Serverfehler (${res.status}): ${t}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return { ok: true };
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ endpoint }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/push/test", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Test fehlgeschlagen (${res.status}): ${t}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
