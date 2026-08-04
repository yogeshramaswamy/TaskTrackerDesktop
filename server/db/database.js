const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// When packaged as a desktop app the code lives in a read-only bundle, so the
// database must be written to a per-user writable location. Electron's main
// process sets TASKTRACKER_DATA_DIR to app.getPath('userData'). In plain dev
// (npm run server) the var is unset and we fall back to this folder.
const DATA_DIR = process.env.TASKTRACKER_DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'tasks.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// On first launch in a fresh data dir, seed from a bundled tasks.db if present
// (so the packaged app ships with your existing tasks instead of an empty DB).
if (!fs.existsSync(DB_PATH)) {
  const seedDb = path.join(__dirname, 'tasks.db');
  if (fs.existsSync(seedDb) && seedDb !== DB_PATH) {
    fs.copyFileSync(seedDb, DB_PATH);
  }
}

let db = null;
let dbReady = null;
let SQL = null; // kept so import/validate can parse uploaded files after init

function initDb() {
  if (dbReady) return dbReady;

  dbReady = initSqlJs().then(SQLjs => {
    SQL = SQLjs;
    let buffer = null;
    if (fs.existsSync(DB_PATH)) {
      buffer = fs.readFileSync(DB_PATH);
    }
    db = buffer ? new SQL.Database(buffer) : new SQL.Database();
    db.exec('PRAGMA foreign_keys = ON');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);

    // Migrations
    try { db.exec('ALTER TABLE tasks ADD COLUMN start_date DATETIME'); } catch (e) { /* already exists */ }
    try { db.exec('ALTER TABLE tasks ADD COLUMN ticket_url TEXT'); } catch (e) { /* already exists */ }
    try { db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER'); } catch (e) { /* already exists */ }

    // Pending deletions table
    db.exec(`CREATE TABLE IF NOT EXISTS pending_deletions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      task_title TEXT NOT NULL,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    saveDb();
    return db;
  });

  return dbReady;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function backupDb() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `tasks-${timestamp}.db`);
  const data = db.export();
  fs.writeFileSync(backupPath, Buffer.from(data));

  // Keep only last 20 backups
  const backups = fs.readdirSync(BACKUP_DIR).sort();
  while (backups.length > 20) {
    fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()));
  }
  return backupPath;
}

function restoreDb(backupFile) {
  const backupPath = path.join(BACKUP_DIR, backupFile);
  if (!fs.existsSync(backupPath)) throw new Error('Backup not found');
  const buffer = fs.readFileSync(backupPath);
  fs.writeFileSync(DB_PATH, buffer);
  return true;
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).sort().reverse();
}

// Write the current live database to an arbitrary path the user chose (e.g. a
// OneDrive folder or USB drive). Exports from memory, so it's always a
// consistent snapshot even while the app is running.
function exportDbTo(destPath) {
  const data = db.export();
  fs.writeFileSync(destPath, Buffer.from(data));
  return destPath;
}

// Tables a genuine TaskTracker database must contain.
const REQUIRED_TABLES = ['projects', 'tasks', 'activity_log', 'reminders', 'daily_journal'];

// Open a candidate file WITHOUT touching the live DB, and confirm it is a real
// TaskTracker SQLite database. Returns { valid, error?, summary? }.
function validateDbFile(filePath) {
  if (!fs.existsSync(filePath)) return { valid: false, error: 'File not found.' };

  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (e) {
    return { valid: false, error: 'Could not read the file.' };
  }

  // SQLite files start with the ASCII header "SQLite format 3\0".
  if (buffer.length < 16 || buffer.slice(0, 15).toString('utf-8') !== 'SQLite format 3') {
    return { valid: false, error: 'Not a SQLite database file (wrong format).' };
  }

  let testDb;
  try {
    testDb = new SQL.Database(buffer);
    const res = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = res.length ? res[0].values.map(r => r[0]) : [];
    const missing = REQUIRED_TABLES.filter(t => !tables.includes(t));
    if (missing.length) {
      return { valid: false, error: `This is not a TaskTracker database (missing: ${missing.join(', ')}).` };
    }

    const count = (t) => {
      const r = testDb.exec(`SELECT COUNT(*) FROM ${t}`);
      return r.length ? r[0].values[0][0] : 0;
    };
    const summary = {
      projects: count('projects'),
      tasks: count('tasks'),
      journalEntries: count('daily_journal'),
      reminders: count('reminders'),
    };
    return { valid: true, summary };
  } catch (e) {
    return { valid: false, error: 'File is not a readable database (may be corrupt).' };
  } finally {
    if (testDb) testDb.close();
  }
}

// Replace the live database with the contents of filePath. Assumes the caller
// has already validated it. Backs up the current DB first, then hot-swaps the
// in-memory db so no server restart is needed.
function importDbFile(filePath) {
  const check = validateDbFile(filePath);
  if (!check.valid) throw new Error(check.error);

  // Safety net: snapshot current data before overwriting.
  backupDb();

  const buffer = fs.readFileSync(filePath);
  if (db) db.close();
  db = new SQL.Database(buffer);
  db.exec('PRAGMA foreign_keys = ON');

  // Make sure any newer tables/columns exist in the imported (possibly older) DB.
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  try { db.exec('ALTER TABLE tasks ADD COLUMN start_date DATETIME'); } catch (e) { /* exists */ }
  try { db.exec('ALTER TABLE tasks ADD COLUMN ticket_url TEXT'); } catch (e) { /* exists */ }
  try { db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER'); } catch (e) { /* exists */ }
  db.exec(`CREATE TABLE IF NOT EXISTS pending_deletions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    task_title TEXT NOT NULL,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  saveDb();
  return check.summary;
}

// While a transaction() is running we suppress the per-statement saveDb() so
// the whole batch is persisted once, atomically, on COMMIT (or discarded on
// ROLLBACK). sql.js is in-memory, so a real BEGIN/ROLLBACK reverts the live db.
let inTransaction = false;

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  stmt.step();
  stmt.free();

  const changes = db.getRowsModified();
  const rowIdResult = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = rowIdResult.length > 0 ? rowIdResult[0].values[0][0] : 0;

  if (!inTransaction) saveDb();
  return { lastInsertRowid, changes };
}

// Run fn() as an all-or-nothing unit. If fn throws, every write it made is
// rolled back and the original data is left untouched. Returns fn()'s value.
function transaction(fn) {
  if (inTransaction) throw new Error('Nested transactions are not supported');
  db.exec('BEGIN');
  inTransaction = true;
  try {
    const result = fn();
    db.exec('COMMIT');
    inTransaction = false;
    saveDb();
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* nothing to roll back */ }
    inTransaction = false;
    saveDb();
    throw err;
  }
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

module.exports = { initDb, getDb, run, all, get, transaction, backupDb, restoreDb, listBackups, saveDb, validateDbFile, importDbFile, exportDbTo };
