// MUT Secure Vault - Database Configuration
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../database/mut_vault.db');
const SCHEMA_PATH = join(__dirname, '../../database/schema.sql');
const SEED_PATH = join(__dirname, '../../database/seed.sql');

let db = null;
let SQL = null;
let initialized = false;

// Wrapper class to provide better-sqlite3 compatible API
class DatabaseWrapper {
  constructor(sqlDb) {
    this.db = sqlDb;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self.db.run(sql, params);
        return { changes: self.db.getRowsModified(), lastInsertRowid: self._getLastInsertRowId() };
      },
      get(...params) {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  _getLastInsertRowId() {
    const result = this.db.exec("SELECT last_insert_rowid() as id");
    return result[0]?.values[0]?.[0] || 0;
  }

  exec(sql) {
    this.db.run(sql);
  }

  pragma(setting) {
    this.db.run(`PRAGMA ${setting}`);
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }

  save() {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  }
}

// Initialize SQL.js and database - call this at server startup
export async function initDB() {
  if (initialized) return db;

  console.log('[DB] Initializing SQL.js...');
  SQL = await initSqlJs();

  // Ensure database directory exists
  const dbDir = dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    console.log('[DB] Loading existing database...');
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new DatabaseWrapper(new SQL.Database(fileBuffer));
  } else {
    console.log('[DB] Creating new database...');
    db = new DatabaseWrapper(new SQL.Database());

    // Initialize schema and seed for new database
    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      const statements = schema.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            db.exec(stmt);
          } catch (e) {
            if (!stmt.includes('DROP TABLE')) {
              console.error('[DB] Schema error:', e.message);
            }
          }
        }
      }
      console.log('[DB] Schema initialized');
    }

    if (fs.existsSync(SEED_PATH)) {
      const seed = fs.readFileSync(SEED_PATH, 'utf8');
      const statements = seed.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            db.exec(stmt);
          } catch (e) {
            if (!e.message.includes('UNIQUE constraint')) {
              console.error('[DB] Seed error:', e.message);
            }
          }
        }
      }
      console.log('[DB] Seed data loaded');
    }

    db.save();
  }

  db.pragma('foreign_keys = ON');
  initialized = true;

  // Auto-save every 30 seconds
  setInterval(() => {
    if (db) db.save();
  }, 30000);

  console.log('[DB] Database ready');
  return db;
}

// Synchronous getter - must call initDB() first at startup
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

export async function initializeDatabase() {
  return initDB();
}

export async function resetDatabase() {
  if (db) {
    db.close();
    db = null;
    initialized = false;
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('[DB] Database file deleted');
  }

  return initDB();
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    initialized = false;
    console.log('[DB] Database connection closed');
  }
}

export default {
  initDB,
  getDatabase,
  initializeDatabase,
  resetDatabase,
  closeDatabase
};
