const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'data', 'schema.sql');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
const db = new Database(DB_PATH);

// WAL mode is faster for concurrent reads (the server) + single writer (sync scripts)
db.pragma('journal_mode = WAL');

db.exec(schema);

// Quick sanity check: list the tables we just created
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Migration done. Tables:', tables.map(t => t.name).join(', '));

db.close();
