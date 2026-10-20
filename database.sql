-- Ledgerly database schema
-- Database engine: SQLite 3 (not MySQL/phpMyAdmin).
-- Shareable clean schema: no accounts, passwords, or financial records.
-- The application creates these tables automatically on first use.

PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, supplier_id INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY, ref TEXT NOT NULL, order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id), amount REAL NOT NULL, status TEXT NOT NULL, supplier_id INTEGER NOT NULL REFERENCES users(id), paid_date TEXT, UNIQUE(supplier_id,ref));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY, count INTEGER NOT NULL, started INTEGER NOT NULL);

COMMIT;
