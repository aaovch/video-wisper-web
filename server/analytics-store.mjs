import { createHash } from 'node:crypto';

const windowMs = 30 * 60 * 1000;
const dayOf = timestamp => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Qyzylorda' }).format(timestamp);

/** Daily aggregates persist. Browser deduplication records expire after 30 minutes. */
export function createAnalyticsStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS analytics_daily (
      day TEXT NOT NULL, slug TEXT NOT NULL, visits INTEGER NOT NULL,
      PRIMARY KEY(day, slug)
    );
    CREATE TABLE IF NOT EXISTS analytics_recent (
      visitor TEXT NOT NULL, slug TEXT NOT NULL, expires INTEGER NOT NULL,
      PRIMARY KEY(visitor, slug)
    );
    CREATE INDEX IF NOT EXISTS analytics_expiry ON analytics_recent(expires);
  `);
  db.prepare('INSERT OR IGNORE INTO analytics_settings VALUES (?, ?)').run('startedAt', new Date().toISOString());
  const purge = (now = Date.now()) => db.prepare('DELETE FROM analytics_recent WHERE expires <= ?').run(now);
  purge();
  return {
    purge,
    record(slug, token, now = Date.now()) {
      const visitor = createHash('sha256').update(token).digest('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        purge(now);
        const added = db.prepare('INSERT OR IGNORE INTO analytics_recent VALUES (?, ?, ?)').run(visitor, slug, now + windowMs);
        if (added.changes) {
          db.prepare(`INSERT INTO analytics_daily VALUES (?, ?, 1)
            ON CONFLICT(day, slug) DO UPDATE SET visits = visits + 1`).run(dayOf(now), slug);
        }
        db.exec('COMMIT');
        return Boolean(added.changes);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    snapshot(slugs) {
      const startedAt = db.prepare("SELECT value FROM analytics_settings WHERE name = 'startedAt'").get().value;
      const rows = new Map(slugs.map(slug => [slug, { slug, visits: 0, daily: [] }]));
      for (const point of db.prepare('SELECT day, slug, visits FROM analytics_daily ORDER BY day').all()) {
        const row = rows.get(point.slug);
        if (!row) continue;
        row.visits += point.visits;
        row.daily.push({ day: point.day, visits: point.visits });
      }
      return { version: 1, generatedAt: new Date().toISOString(), startedAt,
        startDate: dayOf(new Date(startedAt)), endDate: dayOf(new Date()),
        timezone: 'Asia/Qyzylorda', rows: [...rows.values()] };
    }
  };
}
