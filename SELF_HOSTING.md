# Self-Hosting-Anleitung

Diese Anleitung beschreibt, wie du den Hundefutter-Planer unabhängig von Cloudflare auf deinem eigenen Linux-Server betreibst. Der Cloudflare-Setup bleibt parallel nutzbar — dieser Ordner (`self-hosted/`) ist eine vollständige, unabhängige Alternative.

> Du brauchst das jetzt nicht anzufassen, solange der Cloudflare-Setup läuft. Die Anleitung ist dafür da, dass du jederzeit migrieren kannst.

## Architektur auf einen Blick

```
Internet
   │
   ▼
┌─────────────┐    :80/:443 mit Let's-Encrypt-TLS
│    Caddy    │
└──────┬──────┘
       │ reverse_proxy
       ▼
┌────────────────────────────────────────────┐
│  Node.js 20 (Container "app")              │
│  - Hono HTTP-Server (API + Static-Assets)  │
│  - In-Process-Cron (jede Minute)           │
│  - SQLite-Datei im Volume /data            │
└────────────────────────────────────────────┘
```

- **Kein D1, kein Workers-Cron**: alles läuft in einem einzigen Node-Prozess.
- **SQLite-Datei** liegt in einem Docker-Volume (`appdata`). Backups sind trivial (Datei kopieren).
- **Caddy** kümmert sich um HTTPS-Zertifikat (automatisch, kostenlos) — kein nginx-Gefummel.

## Voraussetzungen

- Ein Linux-Server (Hetzner/Ionos/DO/…) mit öffentlicher IPv4-Adresse.  
  Beispiel: Hetzner Cloud CX22 (~€4/Monat) reicht locker.
- Eine Domain oder Subdomain, deren A-Record auf die Server-IP zeigt (z. B. `hundefutter.meinedomain.de`).
- Auf dem Server installiert: `docker` und `docker compose` (moderne Version ab v2).

```bash
# Docker auf Ubuntu 24.04:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# neu einloggen, damit die Gruppenzugehörigkeit wirkt
```

## Schritt 1 — Repo klonen

```bash
git clone https://github.com/Changer400/hundefutter-planer.git
cd hundefutter-planer/self-hosted
```

## Schritt 2 — VAPID-Schlüssel erzeugen

Push braucht einen festen VAPID-Schlüssel pro Deployment. Einmal generieren und sicher aufbewahren (wer die Schlüssel hat, kann Push im Namen deiner Domain senden).

```bash
docker run --rm node:20-alpine npx -y web-push generate-vapid-keys --json
```

Das gibt ein JSON wie:

```json
{
  "publicKey": "BFl0Mx6u...IA9rgI",
  "privateKey": "7yEmB...pgONd"
}
```

## Schritt 3 — `.env` konfigurieren

```bash
cp .env.example .env
$EDITOR .env
```

Trage ein:

```dotenv
DOMAIN=hundefutter.meinedomain.de
VAPID_PUBLIC_KEY=BFl0Mx6u...IA9rgI
VAPID_PRIVATE_KEY=7yEmB...pgONd
VAPID_SUBJECT=mailto:du@meinedomain.de
TIMEZONE=Europe/Berlin
```

Wichtig: Falls du jetzt von Cloudflare migrierst und die bereits registrierten Browser-Subscriptions weiter benutzen willst, musst du **dieselben VAPID-Schlüssel** wie auf Cloudflare eintragen. Neue Subscriptions (nach der Migration) können auch ein neues Paar verwenden — dann müssen alle Nutzer einmal neu auf „Push aktivieren" klicken.

## Schritt 4 — Build + Start

```bash
docker compose up -d --build
```

Das zieht beim ersten Mal Node- und Caddy-Images, baut das Vite-Frontend und den Node-Server. Danach läuft beides im Hintergrund.

Caddy beantragt beim ersten Aufruf automatisch ein Let's-Encrypt-Zertifikat für `$DOMAIN`. Dafür müssen Port 80 und 443 öffentlich erreichbar sein (Firewall in der Hosting-Konsole freigeben).

Check:

```bash
docker compose ps
curl -I https://hundefutter.meinedomain.de/healthz
# → HTTP/2 200
```

## Schritt 5 — App öffnen

https://hundefutter.meinedomain.de aufrufen → „Konto anlegen" → Push aktivieren → fertig.

## Daten-Migration von Cloudflare D1 (optional)

Nur nötig, wenn du deine bestehenden Benutzerkonten + Futterdaten mitnehmen willst. Die Passwort-Hash-Formate sind zwischen beiden Ports identisch (`pbkdf2_sha256$…`), also lassen sich die Daten direkt kopieren.

1. Auf einem Rechner mit installierter `wrangler`-CLI die D1-DB komplett exportieren:

   ```bash
   npx wrangler d1 export hundefutter-planer --remote --output=dump.sql
   ```

2. Die Dump-SQL auf den Server kopieren:

   ```bash
   scp dump.sql user@server:~/
   ```

3. In den App-Container reinschreiben:

   ```bash
   # Stoppe den Server, damit nichts parallel schreibt
   docker compose stop app
   # SQLite-Datei im Volume leeren und Dump einspielen
   docker compose run --rm -v "$(pwd)/dump.sql:/dump.sql:ro" app \
     sh -lc 'rm -f /data/hundefutter.db && \
             sqlite3 /data/hundefutter.db < /dump.sql'
   docker compose up -d app
   ```

   Das Startup spielt die Migrationen danach automatisch nach, falls der Dump älter ist als der Schema-Stand (z. B. ohne `time`-Spalte in `push_fired`).

## Backup

Die gesamte App-State liegt in einer Datei:

```bash
docker run --rm -v hundefutter-planer_appdata:/data -v "$(pwd)":/out alpine \
  sh -c 'cp /data/hundefutter.db /out/hundefutter-$(date +%Y%m%d).db'
```

Das Kommando in einen Cron-Job packen (z. B. `/etc/cron.daily/hundefutter-backup`).

## Updates einspielen

```bash
git pull
docker compose up -d --build
```

Alte SQLite-Datei bleibt im Volume erhalten, Migrationen werden idempotent nachgezogen.

## Logs / Debugging

```bash
docker compose logs -f app
docker compose logs -f caddy
```

Healthcheck aus dem Host:

```bash
docker compose exec app wget -qO- http://localhost:8787/healthz
```

SQLite direkt anschauen:

```bash
docker compose exec app sh -lc 'apt-get update -qq && apt-get install -y -qq sqlite3 && sqlite3 /data/hundefutter.db "SELECT count(*) FROM users;"'
```

## Zurück zu Cloudflare wechseln

Kein Hexenwerk: DNS-A-Record wieder auf Cloudflare Pages umstellen, die alten Cloudflare-Services laufen unverändert weiter. Kein Code-Revert nötig.

## Häufige Probleme

### Caddy kriegt kein Zertifikat
- Stelle sicher dass `DOMAIN` in der `.env` exakt dem öffentlich erreichbaren A-Record entspricht (kein www-Prefix in der ENV, falls der A-Record ohne `www` ist).
- Prüfe mit `curl -I http://$DOMAIN/` dass Port 80 erreichbar ist (Firewall!). Let's Encrypt validiert über Port 80.

### Push kommt nicht an
- `docker compose logs -f app` zeigt den Cron-Output (nur bei `sent>0` oder Fehlern).
- Prüfen, ob FCM die Subscription abgelehnt hat: Spalte `last_sent_at` in `push_subscriptions` bleibt dann `NULL`.
- Opera-spezifisch: der Opera-Browser muss im Hintergrund laufen, sonst nimmt er Push nicht entgegen. Für durchgängige Zustellung empfiehlt sich Chrome auf Android.

### Server startet nicht
- `docker compose logs app` lesen — typischerweise fehlt eine Umgebungsvariable.
- `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` dürfen leer sein (dann ist Push abgeschaltet), aber `DOMAIN` muss gesetzt sein.

## Was dieser Port NICHT macht

- Keine E-Mail-Dienste, kein 2FA, kein SSO.
- Kein automatischer Backup nach außen — das musst du selbst einrichten (siehe „Backup" oben).
- Kein Multi-Instance / Clustering — SQLite ist single-node. Für bis zu ~100 Nutzer problemlos; darüber hinaus eher PostgreSQL.
