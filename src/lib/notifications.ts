import { useEffect, useState } from "react";

export type NotifStatus = "granted" | "denied" | "default" | "unsupported";

export function useNotificationStatus(): NotifStatus {
  const [status, setStatus] = useState<NotifStatus>(() => getStatus());

  useEffect(() => {
    const i = setInterval(() => setStatus(getStatus()), 2000);
    return () => clearInterval(i);
  }, []);

  return status;
}

function getStatus(): NotifStatus {
  if (typeof window === "undefined" || !("Notification" in window))
    return "unsupported";
  return Notification.permission as NotifStatus;
}

export function testNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    alert(`${title}\n${body}`);
    return;
  }
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon-192.png" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification(title, { body });
    });
  } else {
    alert(
      `Benachrichtigungen sind blockiert.\n\n${title}\n${body}`,
    );
  }
}
