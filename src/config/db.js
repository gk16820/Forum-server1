import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

let dbInstance = null;

// ─── PostgreSQL Adapter ────────────────────────────────────────────────────────
// Wraps pg.Pool to expose the same .all() / .get() / .run() / .exec() interface
// as the `sqlite` library, so all controllers work without changes.
function convertQuery(sql, params = []) {
  // SQLite uses ? placeholders; PostgreSQL uses $1, $2, ...
  let i = 0;
  let pgSql = sql.replace(/\?/g, () => `$${++i}`);

  // Dialect conversions for PostgreSQL
  // 1. Remove COLLATE NOCASE (PG is case-sensitive by default; use ILIKE instead of LIKE for case-insensitive)
  pgSql = pgSql.replace(/ COLLATE NOCASE/gi, '');
  // 2. Replace LIKE with ILIKE for case-insensitive text search
  pgSql = pgSql.replace(/\bLIKE\b/gi, 'ILIKE');
  // 3. Replace SQLite STRFTIME popularity formula with PostgreSQL equivalent
  pgSql = pgSql.replace(
    /\(\(p\.upvotes \* 10\) \+ p\.views \+ \(p\.comments \* 5\)\) \/ CAST\(\(\(STRFTIME\('%s', 'now'\) - STRFTIME\('%s', p\.createdAt\)\) \/ 3600\.0\) \+ 2\.0 AS REAL\)/gi,
    `((p.upvotes * 10) + p.views + (p.comments * 5)) / (EXTRACT(EPOCH FROM (NOW() - p."createdAt")) / 3600.0 + 2.0)`
  );

  return { pgSql, params };
}

function createPgAdapter(pool) {
  return {
    async all(sql, params = []) {
      const { pgSql, params: p } = convertQuery(sql, params);
      const result = await pool.query(pgSql, p);
      return result.rows;
    },
    async get(sql, params = []) {
      const { pgSql, params: p } = convertQuery(sql, params);
      const result = await pool.query(pgSql, p);
      return result.rows[0] || null;
    },
    async run(sql, params = []) {
      // Auto-append RETURNING id for INSERT statements so lastID works like SQLite
      let runSql = sql;
      if (/^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)) {
        runSql = sql.trimEnd().replace(/;\s*$/, '') + ' RETURNING id';
      }
      const { pgSql, params: p } = convertQuery(runSql, params);
      const result = await pool.query(pgSql, p);
      return {
        lastID: result.rows[0]?.id || null,
        changes: result.rowCount
      };
    },
    async exec(sql) {
      await pool.query(sql);
    }
  };
}

// ─── SQLite Schema (for local dev) ───────────────────────────────────────────
async function applySchemaAndMigrations(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Member',
      avatar TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      interests TEXT DEFAULT '',
      domain TEXT DEFAULT '',
      userType TEXT DEFAULT 'commonuser',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      upvotes INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      domain TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      categories TEXT DEFAULT '[]',
      image TEXT DEFAULT '',
      communityId INTEGER DEFAULT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      parentId INTEGER,
      question TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES posts(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (parentId) REFERENCES comments(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      postId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (postId, userId),
      FOREIGN KEY (postId) REFERENCES posts(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS followers (
      followerId INTEGER NOT NULL,
      followingId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (followerId, followingId),
      FOREIGN KEY (followerId) REFERENCES users(id),
      FOREIGN KEY (followingId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      actorId INTEGER NOT NULL,
      type TEXT NOT NULL,
      postId INTEGER,
      isRead INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (actorId) REFERENCES users(id),
      FOREIGN KEY (postId) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      postId INTEGER NOT NULL,
      category TEXT DEFAULT 'General',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, postId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (postId) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS communities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      createdBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS community_members (
      userId INTEGER NOT NULL,
      communityId INTEGER NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, communityId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (communityId) REFERENCES communities(id)
    );

    CREATE TABLE IF NOT EXISTS bookmark_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT,
      UNIQUE(userId, name)
    );
  `);
}

// ─── PostgreSQL Schema (for production) ───────────────────────────────────────
async function applyPgSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Member',
      avatar TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      interests TEXT DEFAULT '',
      domain TEXT DEFAULT '',
      "userType" TEXT DEFAULT 'commonuser',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      upvotes INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      domain TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      categories TEXT DEFAULT '[]',
      image TEXT DEFAULT '',
      "communityId" INTEGER DEFAULT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      "postId" INTEGER NOT NULL REFERENCES posts(id),
      "userId" INTEGER NOT NULL REFERENCES users(id),
      "parentId" INTEGER,
      question TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS votes (
      "postId" INTEGER NOT NULL REFERENCES posts(id),
      "userId" INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      PRIMARY KEY ("postId", "userId")
    );

    CREATE TABLE IF NOT EXISTS followers (
      "followerId" INTEGER NOT NULL REFERENCES users(id),
      "followingId" INTEGER NOT NULL REFERENCES users(id),
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY ("followerId", "followingId")
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id),
      "actorId" INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      "postId" INTEGER REFERENCES posts(id),
      "isRead" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id),
      "postId" INTEGER NOT NULL REFERENCES posts(id),
      category TEXT DEFAULT 'General',
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE("userId", "postId")
    );

    CREATE TABLE IF NOT EXISTS communities (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      "createdBy" INTEGER NOT NULL REFERENCES users(id),
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS community_members (
      "userId" INTEGER NOT NULL REFERENCES users(id),
      "communityId" INTEGER NOT NULL REFERENCES communities(id),
      "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY ("userId", "communityId")
    );

    CREATE TABLE IF NOT EXISTS bookmark_lists (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER,
      name TEXT,
      UNIQUE("userId", name)
    );
  `);
}

// ─── Main Init ────────────────────────────────────────────────────────────────
export async function initDb() {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // ── Production: PostgreSQL (Supabase) ───────────────────────────────────
    console.log('[db] Connecting to PostgreSQL (Supabase)...');
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    await applyPgSchema(pool);
    dbInstance = createPgAdapter(pool);
    console.log('[db] PostgreSQL connected and schema ready.');
  } else {
    // ── Local: SQLite ───────────────────────────────────────────────────────
    console.log('[db] No DATABASE_URL found, using local SQLite...');
    const dbPath = path.join(projectRoot, 'forum.sqlite');
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    await applySchemaAndMigrations(db);
    dbInstance = db;
    console.log('[db] SQLite ready at', dbPath);
  }

  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}
