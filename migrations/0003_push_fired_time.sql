-- Erweitert den Dedup-Schlüssel um die konkrete Uhrzeit (HH:MM),
-- damit ein Wechsel der Reminder-Zeit einen neuen Push auf allen Geräten auslöst.

CREATE TABLE IF NOT EXISTS push_fired_new (
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  meal TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  fired_at INTEGER NOT NULL,
  PRIMARY KEY (subscription_id, date, meal, time)
);

INSERT OR IGNORE INTO push_fired_new (subscription_id, date, meal, time, fired_at)
  SELECT subscription_id, date, meal, '', fired_at FROM push_fired;

DROP TABLE push_fired;
ALTER TABLE push_fired_new RENAME TO push_fired;
