import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openDatabase, type DB } from "./db.js";
import { startCron } from "./cron.js";
import { authRoutes } from "./routes/auth.js";
import { pushRoutes, type PushConfig } from "./routes/push.js";
import { stateRoutes } from "./routes/state.js";

type Env = {
  Variables: { db: DB; cookieSecure: boolean };
};

function envRequired(name: string): string {
  const v = process.env[name];
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

async function main() {
  const port = Number.parseInt(process.env.PORT ?? "8787", 10);
  const host = process.env.HOST ?? "0.0.0.0";
  const dbPath = resolve(process.env.DATABASE_PATH ?? "./data/hundefutter.db");
  const publicDir = resolve(
    process.env.PUBLIC_DIR ?? "./public",
  );
  const cookieSecure = envBool("COOKIE_SECURE", true);
  const timezone = process.env.TIMEZONE ?? "Europe/Berlin";

  const pushConfig: PushConfig = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  };

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);

  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("cookieSecure", cookieSecure);
    await next();
  });

  app.route("/", authRoutes());
  app.route("/", stateRoutes());
  app.route("/", pushRoutes(pushConfig));

  app.get("/healthz", (c) => c.text("ok"));

  // Static assets (frontend). API routes above win because Hono matches in order.
  if (existsSync(publicDir)) {
    app.use(
      "/*",
      serveStatic({
        root: publicDir,
        // Fall through to SPA index.html for unknown routes.
        rewriteRequestPath: (path) => path,
      }),
    );
    // SPA fallback: serve index.html for any non-API, non-file GET.
    app.get("/*", async (c) => {
      const p = c.req.path;
      if (p.startsWith("/api/") || p === "/sw.js") return c.notFound();
      const indexPath = `${publicDir}/index.html`;
      if (!existsSync(indexPath)) return c.notFound();
      const { readFileSync } = await import("node:fs");
      const html = readFileSync(indexPath, "utf8");
      return c.html(html);
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[server] public dir not found: ${publicDir}`);
  }

  if (pushConfig.publicKey && pushConfig.privateKey) {
    envRequired("VAPID_PUBLIC_KEY");
    envRequired("VAPID_PRIVATE_KEY");
    startCron(db, {
      vapidPublicKey: pushConfig.publicKey,
      vapidPrivateKey: pushConfig.privateKey,
      vapidSubject: pushConfig.subject,
      timezone,
    });
    // eslint-disable-next-line no-console
    console.log(`[cron] started, tz=${timezone}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[server] VAPID keys missing; push disabled (subscribe/test endpoints will return 503)",
    );
  }

  serve(
    {
      fetch: app.fetch,
      port,
      hostname: host,
    },
    (info) => {
      // eslint-disable-next-line no-console
      console.log(`[server] listening on ${info.address}:${info.port}`);
      // eslint-disable-next-line no-console
      console.log(`[server] database: ${dbPath}`);
      // eslint-disable-next-line no-console
      console.log(`[server] public: ${publicDir}`);
    },
  );

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      // eslint-disable-next-line no-console
      console.log(`\n[server] ${sig} received, shutting down`);
      try {
        db.close();
      } catch {
        /* ignore */
      }
      process.exit(0);
    });
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[server] fatal:", e);
  process.exit(1);
});
