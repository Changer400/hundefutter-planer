import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DB = Database.Database;

function ensureMigrationsTable(db: DB): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`,
  );
}

function appliedMigrations(db: DB): Set<string> {
  ensureMigrationsTable(db);
  const rows = db
    .prepare("SELECT name FROM schema_migrations")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function migrationsDir(): string {
  // When running from dist/server.js, migrations live one level up.
  const candidates = [
    join(__dirname, "..", "migrations"),
    join(__dirname, "..", "..", "migrations"),
  ];
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `migrations directory not found; looked in: ${candidates.join(", ")}`,
  );
}

export function openDatabase(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  runMigrations(db);
  return db;
}

function runMigrations(db: DB): void {
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied = appliedMigrations(db);
  const insert = db.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      insert.run(file, Date.now());
    });
    tx();
    // eslint-disable-next-line no-console
    console.log(`[db] migration applied: ${file}`);
  }
}
